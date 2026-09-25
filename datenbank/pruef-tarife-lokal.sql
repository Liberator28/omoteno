\pset tuples_only on
\pset format unaligned
begin;
select 'T01 null: alles frei (alessia) | ' || tarif_hat('10000000-0000-0000-0000-000000000001','alessia');
update betriebe set plan='starter' where id='10000000-0000-0000-0000-000000000001';
select 'T02 Starter: Gutscheine ja | ' || tarif_hat('10000000-0000-0000-0000-000000000001','gutscheine');
select 'T03 Starter: Newsletter nein | ' || (not tarif_hat('10000000-0000-0000-0000-000000000001','newsletter'));
select 'T04 Starter: KI-Bild nein | ' || (not tarif_hat('10000000-0000-0000-0000-000000000001','bild_ki'));
update betriebe set plan='pro' where id='10000000-0000-0000-0000-000000000001';
select 'T05 Pro: Assistent ja | ' || tarif_hat('10000000-0000-0000-0000-000000000001','assistent');
select 'T06 Pro: Alessia nein | ' || (not tarif_hat('10000000-0000-0000-0000-000000000001','alessia'));
update betriebe set plan='enterprise' where id='10000000-0000-0000-0000-000000000001';
select 'T07 Enterprise: Alessia ja | ' || tarif_hat('10000000-0000-0000-0000-000000000001','alessia');
select 'T08 unbekanntes Merkmal nie | ' || (not tarif_hat('10000000-0000-0000-0000-000000000001','fliegen'));
update betriebe set plan='assistent' where id='10000000-0000-0000-0000-000000000001';
select 'T09 alter Wert assistent = Pro | ' || (tarif_hat('10000000-0000-0000-0000-000000000001','lieferung') and not tarif_hat('10000000-0000-0000-0000-000000000001','studio'));
select 'T10 Bilder: null/starter/pro/enterprise | ' || tarif_bilder_monat(null)||'/'||tarif_bilder_monat('starter')||'/'||tarif_bilder_monat('pro')||'/'||tarif_bilder_monat('enterprise');
do $$ begin update betriebe set plan='gold' where id='10000000-0000-0000-0000-000000000001'; raise notice 'x';
exception when check_violation then perform set_config('probe.t11','abgewiesen',true); end $$;
select 'T11 falscher Tarif | ' || current_setting('probe.t11', true);
select 'T12 anon darf tarif_hat nicht | ' || (not has_function_privilege('anon','public.tarif_hat(uuid,text)','EXECUTE'));
rollback;
