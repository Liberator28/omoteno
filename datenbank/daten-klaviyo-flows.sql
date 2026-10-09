-- ═══════════════════════════════════════════════════════════════════
--  daten-klaviyo-flows.sql · Welche Klaviyo-Flows je Betrieb angelegt sind
--
--  Keine Migration, sondern DATEN: die IDs gibt es nur in diesem einen
--  Klaviyo-Konto. Angelegt am 09.10. über das Klaviyo-Werkzeug, ALLE als
--  Entwurf (Flow-Status draft, jede Mail-Aktion draft — zurückgelesen).
--  Live schaltet der Betreiber in Klaviyo selbst.
--
--  Willkommen   = Listen-Auslöser → Mail „Willkommensgutschein“
--  Rückholung   = Datum omoteno_<slug>_letzter_besuch → 20 Tage warten →
--                 Mail „Wir vermissen Sie“; Filter an jedem Schritt:
--                 in der Liste UND letzter Besuch mindestens 20 Tage her
--                 (wer zwischendurch kommt, fällt heraus).
--
--  Idempotent: on conflict ersetzt nur flow_id/vorlage_id.
-- ═══════════════════════════════════════════════════════════════════
insert into public.klaviyo_flows (betrieb_id, art, flow_id, vorlage_id)
select b.id, v.art, v.flow_id, v.vorlage_id
  from (values
    ('chocolamour', 'willkommen',  'Vw3752', 'RjSG5g'),
    ('chocolamour', 'rueckholung', 'X7LHLy', 'X8LYv4'),
    ('blend',       'willkommen',  'Xrtf6j', 'RGZXDH'),
    ('blend',       'rueckholung', 'VY9CZL', 'XLr2Qq'),
    ('minhkeey',    'willkommen',  'Wyyrrw', 'Xy4a6Z'),
    ('minhkeey',    'rueckholung', 'TFWdqV', 'T4NqNQ')
  ) v(slug, art, flow_id, vorlage_id)
  join public.betriebe b on b.slug = v.slug
on conflict (betrieb_id, art) do update
  set flow_id = excluded.flow_id, vorlage_id = excluded.vorlage_id;
