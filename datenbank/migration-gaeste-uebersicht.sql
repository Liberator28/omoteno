-- ═══════════════════════════════════════════════════════════════════
--  migration-gaeste-uebersicht.sql · Zahlen für „Gäste & Newsletter“
--
--  Wunsch zweiter Tag: „… so dass der Besitzer auch direkt eine
--  Übersicht in der Webapp hat“. Das Board zeigt in der Newsletter-
--  Gruppe, was in der eigenen Datenbank steht; was Klaviyo gerade tut
--  (Flow live oder Entwurf), holt die Edge Function
--  newsletter-uebersicht — der Klaviyo-Schlüssel bleibt auf dem Server.
--
--  Nur der Inhaber (ist_inhaber, also mit PIN-Pflicht). Ein Team-
--  Mitglied bekommt {ok:false, grund:'kein_zugriff'} — eine Antwort,
--  keine Ausnahme, damit das Board einen Satz zeigen kann (§8.1h).
--  Nur Zahlen, keine Adressen: Die Übersicht braucht keine einzige.
--
--  „vermisst“ = mit Adresse UND letzter Besuch mehr als 20 Tage her —
--  genau die Gäste, die der Rückhol-Flow anschreiben würde.
--
--  ANGEWENDET 09.10. (live), danach zurückgedreht geprobt (§2.2, §2.4):
--    · Choco-Inhaber (request.jwt.claims, PIN-Sitzung) → ok:true mit
--      allen Feldern (gaeste, mit_mail, aktiv_20, vermisst, vorrat,
--      eingeloest_30, umsatz_code_30, newsletter_aktiv, liste, flows[2]).
--    · fremder Betrieb, p_betrieb null → {ok:false,grund:'kein_zugriff'}.
--    · anon → permission denied (kein EXECUTE).
--    · Team-Mitglied: Voraussetzung zuerst gemessen (Rolle 'team', sieht
--      den Betrieb: 1 Zeile), dann {ok:false,grund:'kein_zugriff'}.
--    · Signatur: genau eine Fassung (§2.1).
--  Die Edge Function newsletter-uebersicht (v2) über pg_net gerufen:
--  mit anon-Schlüssel → 200 {ok:false,grund:'kein_zugriff'}, ohne
--  Token → 401. Der Inhaber-Weg durch die Funktion braucht ein echtes
--  Nutzertoken und ist hier nicht gemessen (pruef-klaviyo.js stellt
--  die Antwort im Board).
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.gaeste_uebersicht(p_betrieb uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare v jsonb;
begin
  if p_betrieb is null or not public.ist_inhaber(p_betrieb) then
    return jsonb_build_object('ok', false, 'grund', 'kein_zugriff');
  end if;
  select jsonb_build_object(
    'ok', true,
    'gaeste',    count(*),
    'mit_mail',  count(*) filter (where nullif(btrim(email), '') is not null),
    'aktiv_20',  count(*) filter (where letzter_besuch >= now() - interval '20 days'),
    'vermisst',  count(*) filter (where nullif(btrim(email), '') is not null
                                    and letzter_besuch < now() - interval '20 days'))
    into v
    from public.gaeste where betrieb_id = p_betrieb;

  v := v || jsonb_build_object(
    'vorrat', (select count(*) from public.rabattcodes
                where betrieb_id = p_betrieb and quelle = 'klaviyo' and not eingeloest
                  and (gueltig_bis is null or gueltig_bis > now())),
    'eingeloest_30', (select count(*) from public.rabattcodes
                       where betrieb_id = p_betrieb and eingeloest
                         and eingeloest_am >= now() - interval '30 days'),
    'umsatz_code_30', (select coalesce(round(sum(coalesce(summe, 0) - coalesce(rabatt_betrag, 0)), 2), 0)
                         from public.bestellungen
                        where betrieb_id = p_betrieb and rabatt_code is not null
                          and zeitpunkt >= now() - interval '30 days'
                          and not coalesce(pruefen, false)
                          and status not in ('storniert', 'abgelehnt')),
    'newsletter_aktiv', (select coalesce(newsletter_aktiv, false) from public.betriebe where id = p_betrieb),
    'liste', (select klaviyo_liste_id is not null from public.betriebe where id = p_betrieb),
    'flows', coalesce((select jsonb_agg(jsonb_build_object('art', art, 'flow_id', flow_id) order by art, flow_id)
                         from public.klaviyo_flows where betrieb_id = p_betrieb), '[]'::jsonb));
  return v;
end $function$;

revoke execute on function public.gaeste_uebersicht(uuid) from public, anon;
grant  execute on function public.gaeste_uebersicht(uuid) to authenticated;
