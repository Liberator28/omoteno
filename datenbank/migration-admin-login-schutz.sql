-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION · Drei Fehlversuche, dann Sperre bis zur E-Mail-Bestätigung
--
--   Im Supabase SQL-Editor in EINEM Rutsch ausführen. Additiv: keine
--   Zeile wird gelöscht, keine bestehende Funktion verändert.
--
-- Was hier gebaut wird und warum
-- ───────────────────────────────
-- Drei falsche Passworteingaben für dasselbe Konto sperren die
-- Anmeldung. Aufgehoben wird die Sperre NUR, indem der Wirt über
-- „Passwort vergessen" eine E-Mail bekommt, den Link öffnet und ein
-- neues Passwort setzt — kein Zeitablauf, kein zweiter Weg.
--
-- Die ehrliche Grenze zuerst, weil sie die ganze Architektur erklärt:
-- Supabase Auth (GoTrue) prüft Passwörter in einem eigenen Dienst, den
-- diese Migration nicht anfassen kann. Ohne einen sogenannten
-- „Auth Hook" — eine Funktion, die GoTrue bei JEDER Passwortprüfung
-- selbst aufruft — bleibt der öffentliche Endpunkt
-- /auth/v1/token?grant_type=password IMMER erreichbar, unabhängig
-- davon, was diese Migration tut. Der genaue Vertrag dieses Hooks
-- (welche Felder er bekommt, welche er zurückerwartet) konnte von der
-- Arbeitsumgebung aus nicht nachgeschlagen werden — supabase.com ist
-- dort gesperrt (Egress-Proxy, gemessen). Einen Hook mit geratenem
-- Vertrag scharf zu schalten, könnte im schlimmsten Fall JEDE Anmeldung
-- blockieren, sobald er aktiv ist — das Risiko ist zu groß, um es
-- ungeprüft einzugehen (CLAUDE.md §2.2: „Funktionskörper werden nicht
-- beim Anlegen geprüft").
--
-- Diese Migration prüft das Passwort deshalb SELBST, in einer eigenen
-- Funktion, per pgcrypto — bevor die Seite den echten Supabase-Login
-- überhaupt aufruft. Das schützt zuverlässig den tatsächlichen Weg,
-- den jeder Gast oder Angreifer im Browser nimmt: das Anmeldeformular
-- des Boards. Ein Angreifer, der stattdessen Rohanfragen direkt gegen
-- Supabase schreibt, kommt an dieser Sperre vorbei — das steht unten
-- unter „Was diese Migration nicht kann" noch einmal ausdrücklich.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────
-- 1 · Die Zählung, ein Konto pro Zeile
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.admin_login_schutz(
  nutzer_id     uuid primary key references auth.users(id) on delete cascade,
  fehlversuche  int not null default 0,
  gesperrt      boolean not null default false,
  gesperrt_seit timestamptz,
  aktualisiert  timestamptz not null default now()
);

-- Kein Client bekommt direkten Zugriff auf diese Tabelle — das ganze
-- Lesen und Schreiben läuft über die Funktion unten (CLAUDE.md §2.3a:
-- die Regel entscheidet, welche Zeile, das Recht entscheidet, ob
-- überhaupt. Hier: gar keins, außer über die Funktion).
revoke all on public.admin_login_schutz from anon, authenticated, public;

-- ───────────────────────────────────────────────────────────────────
-- 2 · Die Anmeldung selbst
--
--     Wird von der Seite VOR dem echten Supabase-Login gerufen. Prüft
--     das Passwort per pgcrypto GEGEN denselben Hash, den GoTrue auch
--     benutzt (bcrypt über extensions.crypt) — das Ergebnis ist also
--     nicht geraten, sondern derselbe Vergleich, den Supabase selbst
--     anstellt.
--
--     search_path bleibt auf 'public' — extensions.crypt wird
--     ausdrücklich mit Schemanamen aufgerufen, nicht über einen
--     aufgeweichten Suchpfad erreichbar gemacht (CLAUDE.md §2.2: der
--     search_path bei security definer ist genau die Tür, gegen die
--     er da ist).
-- ───────────────────────────────────────────────────────────────────
create or replace function public.admin_anmelden(p_email text, p_passwort text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nutzer    auth.users%rowtype;
  v_schutz    public.admin_login_schutz%rowtype;
  v_richtig   boolean := false;
begin
  if p_email is null or p_passwort is null or btrim(p_email) = '' or p_passwort = '' then
    return jsonb_build_object('erlaubt', false, 'gesperrt', false,
      'nachricht', 'Bitte E-Mail und Passwort eintragen.');
  end if;

  select * into v_nutzer from auth.users where lower(email) = lower(btrim(p_email));

  -- Unbekannte E-Mail meldet DIESELBE Nachricht wie ein falsches
  -- Passwort — sonst verrät die Antwort, welche Adressen ein Konto
  -- haben (dieselbe Vorsicht, die Supabase selbst bei "Invalid login
  -- credentials" trägt).
  if v_nutzer.id is null then
    return jsonb_build_object('erlaubt', false, 'gesperrt', false,
      'nachricht', 'E-Mail oder Passwort stimmt nicht.');
  end if;

  select * into v_schutz from public.admin_login_schutz where nutzer_id = v_nutzer.id;
  if v_schutz.nutzer_id is null then
    insert into public.admin_login_schutz(nutzer_id) values (v_nutzer.id)
      returning * into v_schutz;
  end if;

  -- Gesperrt bleibt gesperrt, auch bei richtigem Passwort — genau das
  -- ist der Sinn der Sperre. Das Passwort wird dafür gar nicht erst
  -- geprüft, damit ein gesperrtes Konto keine weiteren Rateversuche
  -- mehr beantwortet.
  if v_schutz.gesperrt then
    return jsonb_build_object('erlaubt', false, 'gesperrt', true,
      'nachricht', 'Zu viele falsche Versuche. Bitte über „Passwort vergessen" die E-Mail bestätigen, um den Zugang wieder freizuschalten.');
  end if;

  if v_nutzer.encrypted_password is not null then
    begin
      v_richtig := (v_nutzer.encrypted_password = extensions.crypt(p_passwort, v_nutzer.encrypted_password));
    exception when others then
      -- Ein Hash in fremdem Format (z. B. ein Konto, das nur per
      -- Google angemeldet wird) darf die Anmeldung nicht zum Absturz
      -- bringen — dann ist das Passwort einfach falsch.
      v_richtig := false;
    end;
  end if;

  if v_richtig then
    update public.admin_login_schutz
      set fehlversuche = 0, aktualisiert = now()
      where nutzer_id = v_nutzer.id;
    return jsonb_build_object('erlaubt', true, 'gesperrt', false, 'nachricht', '');
  end if;

  -- Falsch: zählen, und bei der DRITTEN Fehleingabe sperren.
  update public.admin_login_schutz
    set fehlversuche = fehlversuche + 1,
        gesperrt      = (fehlversuche + 1) >= 3,
        gesperrt_seit = case when (fehlversuche + 1) >= 3 then now() else gesperrt_seit end,
        aktualisiert  = now()
    where nutzer_id = v_nutzer.id
    returning * into v_schutz;

  if v_schutz.gesperrt then
    return jsonb_build_object('erlaubt', false, 'gesperrt', true,
      'nachricht', 'Das war der dritte Fehlversuch. Der Zugang ist jetzt gesperrt — bitte über „Passwort vergessen" die E-Mail bestätigen.');
  end if;

  return jsonb_build_object('erlaubt', false, 'gesperrt', false,
    'nachricht', 'E-Mail oder Passwort stimmt nicht.',
    'verbleibend', 3 - v_schutz.fehlversuche);
end;
$$;

-- Muss von JEDEM aufrufbar sein, der sich anmelden will — vor der
-- Anmeldung ist niemand angemeldet. Die Funktion selbst gibt nie mehr
-- preis als "erlaubt/gesperrt/eine Nachricht/eine Restzahl" und
-- schreibt nur in eine Tabelle, auf die sonst niemand zugreifen kann.
grant execute on function public.admin_anmelden(text, text) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 3 · Die Freischaltung: NUR über eine bestätigte E-Mail
--
--     resetPasswordForEmail() schickt den Link, den Supabase Auth
--     selbst prüft und signiert — kein eigenes Token, kein zweiter
--     Weg daran vorbei. Setzt der Wirt danach ein neues Passwort,
--     schreibt GoTrue das in auth.users.encrypted_password. Genau das
--     ist der Moment, den dieser Trigger abfängt: Sperre und Zähler
--     gehen auf null, weil eine bestätigte E-Mail durchlaufen wurde.
-- ───────────────────────────────────────────────────────────────────
create or replace function public.admin_login_entsperren()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.admin_login_schutz
      set fehlversuche = 0, gesperrt = false, gesperrt_seit = null, aktualisiert = now()
      where nutzer_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists admin_login_entsperren_trg on auth.users;
create trigger admin_login_entsperren_trg
  after update of encrypted_password on auth.users
  for each row execute function public.admin_login_entsperren();

commit;

-- ───────────────────────────────────────────────────────────────────
-- 4 · Proben — in einer zurückgedrehten Transaktion, bevor irgendwer
--     dem Ergebnis glaubt (CLAUDE.md §2.2: „success: true" sagt
--     nichts darüber, ob eine Funktion wirklich läuft).
--
--     raise notice kommt über MCP nicht an, deshalb die temporäre
--     Tabelle als Umweg.
-- ───────────────────────────────────────────────────────────────────
begin;
create temp table probe(schritt text, ergebnis text);

do $$
declare
  v_id uuid;
  v_r  jsonb;
  v_n  int;
begin
  -- Ein Testkonto, das die Probe danach wieder mitnimmt (rollback).
  insert into auth.users(email, encrypted_password)
    values ('probe-login-schutz@omoteno.test',
            extensions.crypt('richtig-123', extensions.gen_salt('bf')))
    returning id into v_id;

  -- 1 · Falsches Passwort wird abgelehnt, ohne zu sperren.
  v_r := public.admin_anmelden('probe-login-schutz@omoteno.test', 'falsch');
  insert into probe values ('1. Fehlversuch lehnt ab, sperrt nicht',
    case when (v_r->>'erlaubt')::boolean = false and (v_r->>'gesperrt')::boolean = false
         then 'ok' else 'FEHL: ' || v_r::text end);

  -- 2 · Richtiges Passwort geht durch.
  v_r := public.admin_anmelden('probe-login-schutz@omoteno.test', 'richtig-123');
  insert into probe values ('richtiges Passwort erlaubt',
    case when (v_r->>'erlaubt')::boolean = true then 'ok' else 'FEHL: ' || v_r::text end);

  -- 3 · Drei Fehlversuche sperren — und ein VIERTER, RICHTIGER Versuch
  --     bleibt draußen. Das ist der eigentliche Zweck der Sperre.
  perform public.admin_anmelden('probe-login-schutz@omoteno.test', 'falsch');
  perform public.admin_anmelden('probe-login-schutz@omoteno.test', 'falsch');
  v_r := public.admin_anmelden('probe-login-schutz@omoteno.test', 'falsch');
  insert into probe values ('3. Fehlversuch sperrt',
    case when (v_r->>'gesperrt')::boolean = true then 'ok' else 'FEHL: ' || v_r::text end);

  v_r := public.admin_anmelden('probe-login-schutz@omoteno.test', 'richtig-123');
  insert into probe values ('richtiges Passwort bleibt draußen, solange gesperrt',
    case when (v_r->>'erlaubt')::boolean = false and (v_r->>'gesperrt')::boolean = true
         then 'ok' else 'FEHL: ' || v_r::text end);

  -- 4 · Das Passwort ändern (wie es der Reset-Link am Ende tut) hebt
  --     die Sperre auf.
  update auth.users set encrypted_password =
    extensions.crypt('neues-passwort-456', extensions.gen_salt('bf'))
    where id = v_id;

  select gesperrt, fehlversuche into strict v_r, v_n from (
    select to_jsonb(gesperrt) as gesperrt, fehlversuche
      from public.admin_login_schutz where nutzer_id = v_id
  ) x;
  insert into probe values ('Passwortwechsel hebt die Sperre auf',
    case when (v_r)::text = 'false' and v_n = 0 then 'ok'
         else 'FEHL: gesperrt=' || v_r::text || ' fehlversuche=' || v_n end);

  v_r := public.admin_anmelden('probe-login-schutz@omoteno.test', 'neues-passwort-456');
  insert into probe values ('neues Passwort meldet sich wieder an',
    case when (v_r->>'erlaubt')::boolean = true then 'ok' else 'FEHL: ' || v_r::text end);

  -- 5 · anon darf die Schutz-Tabelle NICHT direkt lesen (§2.3a: das
  --     Recht entscheidet, ob überhaupt — nicht nur die Regel).
  insert into probe values ('anon liest admin_login_schutz NICHT',
    case when has_table_privilege('anon', 'public.admin_login_schutz', 'SELECT')
         then 'FEHL — anon darf lesen' else 'ok' end);
end $$;

select * from probe;
rollback;
