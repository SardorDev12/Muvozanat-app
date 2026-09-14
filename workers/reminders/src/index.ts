/**
 * Muvozanat reminder worker.
 *
 * Runs once a day and writes a `reassessment_due` notification for every user
 * whose life-wheel reassessment interval has elapsed. The app reads those rows
 * to show its banner; if the user has an Expo push token, a push goes out too.
 *
 * It deliberately does nothing else: all ordinary reads and writes go straight
 * from the app to Supabase under Row Level Security. This worker is the one
 * piece that has to run when nobody has the app open, so it is the one piece
 * that needs the service role key.
 */

export type Env = {
  SUPABASE_URL: string;
  /** Bypasses RLS. Secret — set with `wrangler secret put`. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Optional shared secret enabling the manual POST /run trigger. */
  ADMIN_TRIGGER_SECRET?: string;
};

type DueProfile = {
  id: string;
  locale: 'uz' | 'ru' | 'en';
  display_name: string | null;
  last_assessment_at: string | null;
  next_reassess_at: string | null;
  expo_push_token: string | null;
};

type RunSummary = {
  checked: number;
  notified: number;
  pushed: number;
  pushFailures: number;
};

const PAGE_SIZE = 500;
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
/** Expo's documented maximum messages per push request. */
const EXPO_PUSH_CHUNK = 100;

const PUSH_COPY = {
  uz: {
    title: "G'ildirakka qaytish vaqti",
    body: "Hayotingizning sakkiz sohasini qayta baholang va nima o'zgarganini ko'ring.",
  },
  ru: {
    title: 'Пора вернуться к колесу',
    body: 'Переоцените восемь сфер жизни и посмотрите, что изменилось.',
  },
  en: {
    title: 'Time to revisit your wheel',
    body: 'Re-rate your eight life areas and see what has moved.',
  },
} as const;

function supabaseHeaders(env: Env): HeadersInit {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseHeaders(env), ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Supabase ${init.method ?? 'GET'} ${path} failed (${response.status}): ${detail}`,
    );
  }
  return response;
}

/**
 * Profiles whose reassessment is due: the interval has elapsed, reminders are
 * not switched off, and any "remind me later" has expired.
 */
async function fetchDueProfiles(env: Env, nowIso: string, offset: number): Promise<DueProfile[]> {
  const params = new URLSearchParams({
    select: 'id,locale,display_name,last_assessment_at,next_reassess_at,expo_push_token',
    next_reassess_at: `lte.${nowIso}`,
    or: `(reassess_snoozed_until.is.null,reassess_snoozed_until.lte.${nowIso})`,
    order: 'id.asc',
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });

  const response = await supabaseFetch(env, `profiles?${params.toString()}`);
  return (await response.json()) as DueProfile[];
}

/** Users who already have an unread nudge, so the job never piles them up. */
async function fetchAlreadyNotified(env: Env, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const params = new URLSearchParams({
    select: 'user_id',
    kind: 'eq.reassessment_due',
    dismissed_at: 'is.null',
    user_id: `in.(${userIds.join(',')})`,
  });

  const response = await supabaseFetch(env, `notifications?${params.toString()}`);
  const rows = (await response.json()) as { user_id: string }[];
  return new Set(rows.map((row) => row.user_id));
}

async function insertNotifications(env: Env, profiles: DueProfile[]): Promise<void> {
  if (profiles.length === 0) return;

  const rows = profiles.map((profile) => ({
    user_id: profile.id,
    kind: 'reassessment_due',
    payload: {
      last_assessment_at: profile.last_assessment_at,
      due_at: profile.next_reassess_at,
    },
  }));

  await supabaseFetch(env, 'notifications', {
    method: 'POST',
    body: JSON.stringify(rows),
    headers: { Prefer: 'return=minimal' },
  });
}

/**
 * Best-effort push. A failure here must not fail the run: the in-app banner is
 * the reliable channel and it is already written by this point.
 */
async function sendPushes(profiles: DueProfile[]): Promise<{ sent: number; failed: number }> {
  const messages = profiles
    .filter((profile) => !!profile.expo_push_token)
    .map((profile) => ({
      to: profile.expo_push_token!,
      sound: 'default',
      ...(PUSH_COPY[profile.locale] ?? PUSH_COPY.en),
      data: { kind: 'reassessment_due' },
    }));

  if (messages.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += EXPO_PUSH_CHUNK) {
    const chunk = messages.slice(i, i + EXPO_PUSH_CHUNK);
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (response.ok) {
        sent += chunk.length;
      } else {
        failed += chunk.length;
        console.error('Expo push rejected', response.status, await response.text());
      }
    } catch (error) {
      failed += chunk.length;
      console.error('Expo push threw', error);
    }
  }

  return { sent, failed };
}

export async function runReminderSweep(env: Env): Promise<RunSummary> {
  const nowIso = new Date().toISOString();
  const summary: RunSummary = { checked: 0, notified: 0, pushed: 0, pushFailures: 0 };

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchDueProfiles(env, nowIso, offset);
    if (page.length === 0) break;

    summary.checked += page.length;

    const alreadyNotified = await fetchAlreadyNotified(
      env,
      page.map((profile) => profile.id),
    );
    const toNotify = page.filter((profile) => !alreadyNotified.has(profile.id));

    await insertNotifications(env, toNotify);
    summary.notified += toNotify.length;

    const push = await sendPushes(toNotify);
    summary.pushed += push.sent;
    summary.pushFailures += push.failed;

    if (page.length < PAGE_SIZE) break;
  }

  return summary;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runReminderSweep(env).then(
        (summary) => console.log('reminder sweep complete', summary),
        (error) => console.error('reminder sweep failed', error),
      ),
    );
  },

  /**
   * `GET /health` for uptime checks and `POST /run` to trigger a sweep by hand
   * (useful while setting the project up). The manual trigger stays disabled
   * unless ADMIN_TRIGGER_SECRET is configured.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/run') {
      if (!env.ADMIN_TRIGGER_SECRET) {
        return new Response('Manual trigger is not enabled', { status: 404 });
      }
      if (request.headers.get('x-admin-secret') !== env.ADMIN_TRIGGER_SECRET) {
        return new Response('Forbidden', { status: 403 });
      }

      try {
        return Response.json(await runReminderSweep(env));
      } catch (error) {
        console.error('manual sweep failed', error);
        return new Response('Sweep failed', { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
