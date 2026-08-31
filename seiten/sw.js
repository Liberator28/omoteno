/* ═══════════════════════════════════════════════════════════════
   OMOTENO · Service Worker

   Gehört neben admin.html. Genau diese Datei registriert das Board
   in pushEinrichten():

       navigator.serviceWorker.register("sw.js")

   Bis zum 30.08. gab es sie nicht — weder im Verzeichnis noch im
   ausgelieferten Ordner. Die Registrierung lief damit auf einen
   404, pushEinrichten() gab {ok:false} zurück, und das Personal
   bekam nie eine Meldung über eine neue Bestellung. Alles andere
   war fertig: der VAPID-Schlüssel im Board, die Tabelle
   push_geraete und die Edge-Funktion „melden", die längst sendet.
   Es fehlte nur der Empfänger.

   Was diese Datei NICHT tut: zwischenspeichern. Ein Service Worker,
   der Dateien festhält, ist genau der Grund, warum ein Board nach
   einer Auslieferung noch tagelang die alte Fassung zeigt. Das
   Board holt seine Daten alle paar Sekunden frisch; es hat von
   einem Zwischenspeicher nichts und von einer alten Fassung nur
   Ärger.
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* Sofort übernehmen statt auf das Schließen aller Fenster zu warten.
   Ohne das bliebe nach einer Auslieferung die vorige Fassung aktiv,
   bis das Personal jeden Tab schließt — im Betrieb also nie. */
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", e  => e.waitUntil(self.clients.claim()));

/* Was „melden" schickt:
   { id, quelle, titel, text, url }
   Der Text ist bewusst so gebaut, dass er auf dem Sperrbildschirm
   ohne Entsperren verständlich ist. */
self.addEventListener("push", ereignis => {
  let m = {};
  try { m = ereignis.data ? ereignis.data.json() : {}; }
  catch(e){ m = { text: (ereignis.data && ereignis.data.text()) || "" }; }

  const titel = m.titel || "Omoteno";
  const dienst = m.quelle === "service";

  /* showNotification MUSS bei jedem push aufgerufen werden. Das Abo
     läuft mit userVisibleOnly:true; bleibt die Meldung aus, zeigt der
     Browser von sich aus „Diese Seite wurde im Hintergrund
     aktualisiert" — und entzieht bei Wiederholung die Erlaubnis. */
  ereignis.waitUntil(
    self.registration.showNotification(titel, {
      body: m.text || "",
      /* Das Board liegt im selben Ordner; ein eigenes Symbol gibt es
         nicht, deshalb keins angeben statt auf ein 404 zu zeigen. */
      tag: dienst ? "omoteno-service" : ("omoteno-" + (m.id || Date.now())),
      /* Servicerufe drängen, Bestellungen nicht: Ein Ruf ersetzt den
         vorigen Ruf, eine Bestellung steht neben der vorigen. */
      renotify: dienst,
      requireInteraction: dienst,
      vibrate: dienst ? [120, 60, 120] : [80],
      data: { url: m.url || "/admin.html" },
      timestamp: Date.now()
    })
  );
});

/* Antippen bringt das Board nach vorn, statt einen zweiten Tab zu
   öffnen. Läuft schon eins, wird es fokussiert — sonst steht das
   Personal am Ende vor fünf Boards. */
self.addEventListener("notificationclick", ereignis => {
  ereignis.notification.close();
  const ziel = (ereignis.notification.data && ereignis.notification.data.url) || "/admin.html";
  ereignis.waitUntil(
    self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(fenster => {
      for(const f of fenster){
        if(f.url.indexOf("/admin") > -1 && "focus" in f) return f.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(ziel) : undefined;
    })
  );
});
