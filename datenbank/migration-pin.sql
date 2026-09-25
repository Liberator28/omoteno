-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET 2026-09-25 (Supabase, Migration „pin_zweiter_faktor“).
--  Vorher lokal in PG16 gegen einen Nachbau: 46 Proben, Gegenbeweis
--  (meine_betriebe ohne pin_ok) 6 rot. Danach live in zurückgedrehter
--  Transaktion: pruef-rechte.sql TEIL 7, 13 von 13, echte Karte (103).
--
--  MIGRATION · Zweiter Faktor: 8-stellige PIN je Konto
--
--  Wunsch 25.09.2026: Jedes Admin- und Küchen-Board fragt nach dem
--  Passwort eine 8-stellige PIN. Vergeben, erneuert und entsperrt wird
--  sie vom Master; ob ein Betrieb sie verlangt, schaltet der Master.
--
--  WIE ES ERZWUNGEN WIRD — und warum nicht im Browser
--  ──────────────────────────────────────────────────
--  Ein PIN-Schirm allein wäre Zierrat: Wer das Passwort hat, fragt die
--  Daten direkt über die Schnittstelle ab und sieht den Schirm nie
--  (§2.3a). Deshalb hängt die PIN an meine_betriebe() — der Funktion,
--  an der JEDE Team-Regel hängt (gezählt 25.09.: 30 Regeln auf 17
--  Tabellen und die drei Speicherregeln für Bilder). Verlangt ein
--  Betrieb die PIN, liefert meine_betriebe() ihn erst, wenn für DIESE
--  Anmeldung (session_id im Token) die PIN stimmte. Keine neue Regel,
--  keine Regel vergessen.
--
--  Signatur bleibt gleich (§2.1): create or replace ohne neue
--  Parameter. Zwei Stellen umgingen meine_betriebe() und fragten
--  betrieb_mitglieder selbst — die Regel rabattcodes_eigene_lesen und
--  rechnung_rabattieren(). Beide hängen jetzt auch daran.
--
--  WAS NICHT PASSIERT (§7): Nichts ändert sich, solange kein Betrieb
--  pin_pflicht hat — Voreinstellung aus. Einschalten verweigert
--  pin_pflicht_setzen(), solange ein Mitglied noch keine PIN hat;
--  sonst sperrte der Schalter genau die aus, die rein dürfen.
--
--  Der Master: Hat ein Master-Konto selbst eine PIN, verlangt
--  ist_master() sie auch. Ohne PIN bleibt es wie bisher — sonst sperrte
--  sich der Master mit dem Einspielen dieser Datei selbst aus.
--
--  NOTWEG: Der SQL-Editor (Service-Rolle) umgeht RLS immer.
--    update public.betriebe set pin_pflicht = false where id = '…';
--    delete from public.konto_pin where nutzer_id = '…';
--
--  Additiv bis auf die zwei ersetzten Funktionskörper und die eine
--  ersetzte Regel; alles in einer Transaktion.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Tabellen ───────────────────────────────────────────────────
create table if not exists public.konto_pin (
  nutzer_id    uuid primary key references auth.users(id) on delete cascade,
  pin_hash     text not null,
  fehlversuche integer not null default 0 check (fehlversuche between 0 and 99),
  gesperrt     boolean not null default false,
  gesetzt_am   timestamptz not null default now(),
  gesetzt_von  uuid
);

-- Eine Zeile je Anmeldung, für die die PIN stimmte. session_id bleibt
-- über jede Token-Erneuerung gleich — das Küchentablet fragt also nur
-- nach einer NEUEN Anmeldung, nicht stündlich.
create table if not exists public.pin_sitzungen (
  nutzer_id uuid not null references auth.users(id) on delete cascade,
  sitzung   text not null,
  bis       timestamptz not null,
  primary key (nutzer_id, sitzung)
);

alter table public.konto_pin     enable row level security;
alter table public.pin_sitzungen enable row level security;
-- Keine Regel, keine Rechte: nur über die Funktionen unten erreichbar.
revoke all on public.konto_pin, public.pin_sitzungen from public, anon, authenticated;

alter table public.betriebe add column if not exists pin_pflicht boolean not null default false;
comment on column public.betriebe.pin_pflicht is
  'Verlangt nach dem Passwort die 8-stellige PIN (konto_pin). Nur über pin_pflicht_setzen().';
grant select (pin_pflicht) on public.betriebe to authenticated;

-- ── 2 · Die Erzwingung ────────────────────────────────────────────
create or replace function public.pin_ok()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.pin_sitzungen s
     where s.nutzer_id = auth.uid()
       and s.sitzung = coalesce(auth.jwt() ->> 'session_id', '')
       and s.bis > now()
  );
$$;

create or replace function public.meine_betriebe()
returns setof uuid
language sql stable security definer
set search_path to 'public'
as $$
  select m.betrieb_id
    from public.betrieb_mitglieder m
    join public.betriebe b on b.id = m.betrieb_id
   where m.nutzer_id = auth.uid()
     and (b.pin_pflicht is not true or public.pin_ok());
$$;

create or replace function public.ist_master()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.master_konten where benutzer_id = auth.uid())
     and (not exists (select 1 from public.konto_pin where nutzer_id = auth.uid())
          or public.pin_ok());
$$;

-- ── 3 · Anmelden mit PIN ──────────────────────────────────────────
create or replace function public.pin_status()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_pin public.konto_pin%rowtype;
  v_master boolean;
  v_pflicht boolean;
begin
  if v_uid is null then
    return jsonb_build_object('angemeldet', false);
  end if;
  select * into v_pin from public.konto_pin where nutzer_id = v_uid;
  v_master := exists (select 1 from public.master_konten where benutzer_id = v_uid);
  v_pflicht := exists (
      select 1 from public.betrieb_mitglieder m join public.betriebe b on b.id = m.betrieb_id
       where m.nutzer_id = v_uid and b.pin_pflicht)
    or (v_master and v_pin.nutzer_id is not null);
  return jsonb_build_object(
    'angemeldet', true,
    'pflicht',    v_pflicht,
    'hat_pin',    v_pin.nutzer_id is not null,
    'ok',         public.pin_ok(),
    'gesperrt',   coalesce(v_pin.gesperrt, false),
    'verbleibend', greatest(0, 5 - coalesce(v_pin.fehlversuche, 0)),
    'master',     v_master);
end;
$$;

create or replace function public.pin_pruefen(p_pin text)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_sitzung text := coalesce(auth.jwt() ->> 'session_id', '');
  v_pin public.konto_pin%rowtype;
  v_neu integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet'); end if;
  if v_sitzung = '' then return jsonb_build_object('ok', false, 'grund', 'keine_sitzung'); end if;
  select * into v_pin from public.konto_pin where nutzer_id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'grund', 'keine_pin'); end if;
  if v_pin.gesperrt then return jsonb_build_object('ok', false, 'grund', 'gesperrt', 'verbleibend', 0); end if;
  -- Ein Tippfehler in der Form (7 Ziffern, Buchstabe) zählt nicht als Versuch.
  if coalesce(p_pin, '') !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok', false, 'grund', 'form', 'verbleibend', 5 - v_pin.fehlversuche);
  end if;

  if v_pin.pin_hash = extensions.crypt(p_pin, v_pin.pin_hash) then
    update public.konto_pin set fehlversuche = 0 where nutzer_id = v_uid;
    delete from public.pin_sitzungen where nutzer_id = v_uid and bis < now();
    insert into public.pin_sitzungen (nutzer_id, sitzung, bis)
      values (v_uid, v_sitzung, now() + interval '30 days')
      on conflict (nutzer_id, sitzung) do update set bis = excluded.bis;
    return jsonb_build_object('ok', true);
  end if;

  v_neu := v_pin.fehlversuche + 1;
  update public.konto_pin
     set fehlversuche = v_neu, gesperrt = (v_neu >= 5)
   where nutzer_id = v_uid;
  return jsonb_build_object('ok', false,
    'grund', case when v_neu >= 5 then 'gesperrt' else 'falsch' end,
    'verbleibend', greatest(0, 5 - v_neu));
end;
$$;

-- ── 4 · Was nur der Master darf ───────────────────────────────────
create or replace function public.pin_setzen(p_nutzer uuid, p_pin text)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public'
as $$
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  if coalesce(p_pin, '') !~ '^[0-9]{8}$' then return jsonb_build_object('ok', false, 'grund', 'form'); end if;
  if p_pin ~ '^([0-9])\1{7}$'
     or p_pin in ('12345678','23456789','01234567','87654321','98765432','76543210') then
    return jsonb_build_object('ok', false, 'grund', 'zu_einfach');
  end if;
  if not exists (select 1 from auth.users where id = p_nutzer) then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;
  insert into public.konto_pin (nutzer_id, pin_hash, fehlversuche, gesperrt, gesetzt_am, gesetzt_von)
    values (p_nutzer, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), 0, false, now(), auth.uid())
    on conflict (nutzer_id) do update
      set pin_hash = excluded.pin_hash, fehlversuche = 0, gesperrt = false,
          gesetzt_am = now(), gesetzt_von = auth.uid();
  -- Eine neue PIN gilt ab der nächsten Eingabe — alte Freigaben fallen.
  delete from public.pin_sitzungen where nutzer_id = p_nutzer;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.pin_entsperren(p_nutzer uuid)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public'
as $$
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  update public.konto_pin set fehlversuche = 0, gesperrt = false where nutzer_id = p_nutzer;
  return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.pin_entfernen(p_nutzer uuid)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public'
as $$
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  -- Wer in einem Betrieb mit PIN-Pflicht steht, darf seine PIN nicht
  -- verlieren — er käme an nichts mehr heran.
  if exists (select 1 from public.betrieb_mitglieder m join public.betriebe b on b.id = m.betrieb_id
              where m.nutzer_id = p_nutzer and b.pin_pflicht) then
    return jsonb_build_object('ok', false, 'grund', 'pflicht_aktiv');
  end if;
  delete from public.pin_sitzungen where nutzer_id = p_nutzer;
  delete from public.konto_pin where nutzer_id = p_nutzer;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.pin_pflicht_setzen(p_betrieb uuid, p_an boolean)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public'
as $$
declare
  v_fehlt jsonb;
begin
  if not public.ist_master() then return jsonb_build_object('ok', false, 'grund', 'kein_master'); end if;
  if p_an then
    select coalesce(jsonb_agg(coalesce(u.email, m.nutzer_id::text) order by u.email), '[]'::jsonb)
      into v_fehlt
      from public.betrieb_mitglieder m
      left join auth.users u on u.id = m.nutzer_id
     where m.betrieb_id = p_betrieb
       and not exists (select 1 from public.konto_pin p where p.nutzer_id = m.nutzer_id);
    if jsonb_array_length(v_fehlt) > 0 then
      return jsonb_build_object('ok', false, 'grund', 'pin_fehlt', 'fehlt', v_fehlt);
    end if;
  end if;
  update public.betriebe set pin_pflicht = p_an where id = p_betrieb;
  return jsonb_build_object('ok', found);
end;
$$;

-- Alle Konten mit Betrieb, Rolle, PIN- und Sperrstand — für die Zentrale.
create or replace function public.master_zugaenge()
returns table (nutzer_id uuid, email text, betrieb_id uuid, betrieb_name text, rolle text,
               zuletzt timestamptz, bestaetigt boolean, hat_pin boolean, pin_gesperrt boolean,
               login_gesperrt boolean, ist_master boolean, pin_pflicht boolean)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.ist_master() then return; end if;
  return query
    select u.id, u.email::text, m.betrieb_id, b.name::text, m.rolle::text,
           u.last_sign_in_at, (u.email_confirmed_at is not null),
           (p.nutzer_id is not null), coalesce(p.gesperrt, false),
           coalesce(s.gesperrt, false),
           exists (select 1 from public.master_konten mk where mk.benutzer_id = u.id),
           coalesce(b.pin_pflicht, false)
      from auth.users u
      left join public.betrieb_mitglieder m on m.nutzer_id = u.id
      left join public.betriebe b on b.id = m.betrieb_id
      left join public.konto_pin p on p.nutzer_id = u.id
      left join public.admin_login_schutz s on s.nutzer_id = u.id
     order by b.name nulls last, u.email, u.id;
end;
$$;

-- ── 5 · Die zwei Stellen, die meine_betriebe() umgingen ────────────
drop policy if exists rabattcodes_eigene_lesen on public.rabattcodes;
create policy rabattcodes_eigene_lesen on public.rabattcodes
  for select to authenticated
  using (betrieb_id in (select public.meine_betriebe()));

create or replace function public.rechnung_rabattieren(p_bestellung_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bestellung record;
  v_code       record;
  v_neuer_rabatt numeric(8,2);
begin
  select id, betrieb_id, summe into v_bestellung
    from public.bestellungen where id = p_bestellung_id;

  if v_bestellung.id is null then
    return jsonb_build_object('ok', false, 'grund', 'bestellung_unbekannt');
  end if;

  -- Vorher: eigene Abfrage auf betrieb_mitglieder — an der PIN vorbei.
  if v_bestellung.betrieb_id not in (select public.meine_betriebe()) then
    return jsonb_build_object('ok', false, 'grund', 'kein_zugriff');
  end if;

  select id, betrag, prozent, eingeloest, gueltig_bis into v_code
    from public.rabattcodes
    where betrieb_id = v_bestellung.betrieb_id and code = p_code
    for update;

  if v_code.id is null then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;
  if v_code.eingeloest then
    return jsonb_build_object('ok', false, 'grund', 'bereits_eingeloest');
  end if;
  if v_code.gueltig_bis is not null and v_code.gueltig_bis < now() then
    return jsonb_build_object('ok', false, 'grund', 'abgelaufen');
  end if;

  v_neuer_rabatt := coalesce(v_code.betrag, round(v_bestellung.summe * v_code.prozent / 100, 2));

  update public.rabattcodes
    set eingeloest = true, eingeloest_bestellung_id = p_bestellung_id, eingeloest_am = now()
    where id = v_code.id;

  update public.bestellungen
    set rabatt_betrag = v_neuer_rabatt, rabatt_code = p_code
    where id = p_bestellung_id;

  return jsonb_build_object('ok', true, 'rabatt_betrag', v_neuer_rabatt,
    'endbetrag', v_bestellung.summe - v_neuer_rabatt);
end;
$$;

-- ── 6 · Rechte (§2.3a: jede Funktion in public ist ein rpc-Endpunkt) ─
revoke all on function public.pin_ok(), public.pin_status(), public.pin_pruefen(text),
  public.pin_setzen(uuid, text), public.pin_entsperren(uuid), public.pin_entfernen(uuid),
  public.pin_pflicht_setzen(uuid, boolean), public.master_zugaenge()
  from public, anon;
grant execute on function public.pin_ok(), public.pin_status(), public.pin_pruefen(text),
  public.pin_setzen(uuid, text), public.pin_entsperren(uuid), public.pin_entfernen(uuid),
  public.pin_pflicht_setzen(uuid, boolean), public.master_zugaenge()
  to authenticated;
-- Ein Trigger braucht kein EXECUTE; als rpc-Endpunkt hat er nichts verloren.
revoke all on function public.admin_login_entsperren() from public, anon, authenticated;

commit;
