/* Languages: English (source) and German.
 *
 * The app is written in English. In German, every text that ends up on the page is translated on
 * the way in: a MutationObserver looks at new text nodes and attributes (placeholder, aria-label,
 * title, alt) and swaps them before the browser paints. confirm() and prompt() go through the same
 * function. So the rest of the code keeps plain English strings; a missing translation just shows
 * English. Texts the user typed are left alone: inputs keep their value, and elements marked
 * translate="no" (notes) are skipped.
 *
 * Exact texts are looked up in DE. Texts with numbers or names come from PATTERNS. Texts made of
 * parts joined by " · " or ", " are translated part by part (exercise name · equipment, muscle
 * lists). Debug: I18n.misses lists English texts seen without a translation. */
const I18n = (() => {
  const KEY = 'gymlog.lang';
  const lang = localStorage.getItem(KEY) || (/^de\b/i.test(navigator.language || '') ? 'de' : 'en');

  const DE = {
    // --- tabs, common ---
    'Training': 'Training', 'Charts': 'Statistik', 'Settings': 'Einstellungen', 'Exercises': 'Übungen',
    'Done': 'Fertig', 'Cancel': 'Abbrechen', 'Save': 'Speichern', 'Delete': 'Löschen', 'Edit': 'Bearbeiten',
    'Remove': 'Entfernen', 'Add': 'Hinzufügen', 'Confirm': 'Bestätigen', 'Options': 'Optionen', 'Start': 'Starten',
    'Skip': 'Überspringen', 'Update': 'Aktualisieren', 'Enter': 'Eingabe', 'Image': 'Bild', 'Name': 'Name',
    'Note': 'Notiz', 'Workout': 'Workout', 'Workouts': 'Workouts', 'Set': 'Satz', 'Sets': 'Sätze', 'Reps': 'Wdh.',
    'Weight': 'Gewicht', 'Time': 'Zeit', 'Duration': 'Dauer', 'Volume': 'Volumen', 'Total': 'Gesamt', 'Best': 'Best',
    'History': 'Verlauf', 'Favorites': 'Favoriten', 'Plans': 'Pläne', 'Deload': 'Deload', 'Off': 'Aus',
    'Front': 'Vorne', 'Back': 'Hinten', 'Value': 'Wert', 'Type': 'Typ', 'Trend': 'Trend', 'Exercise': 'Übung',
    'Email': 'E-Mail', 'Code': 'Code', 'Metric': 'Messart', 'Muscles': 'Muskeln', 'Primary': 'Primär',
    'Secondary': 'Sekundär', 'since': 'seit', 'total': 'gesamt', 'last 7 days': 'letzte 7 Tage', 'duration': 'Dauer',
    'sets': 'Sätze', 'kg volume': 'kg Volumen', 'Sessions': 'Einheiten', 'optional': 'optional', 'today': 'heute',
    'this week': 'diese Woche', 'Go!': 'Los!', 'Workout A': 'Workout A', 'My plan': 'Mein Plan',
    'New version available': 'Neue Version verfügbar', 'zZZ': 'zZZ',
    // weekdays (week strip, calendar)
    'Mo': 'Mo', 'Tu': 'Di', 'We': 'Mi', 'Th': 'Do', 'Fr': 'Fr', 'Sa': 'Sa', 'Su': 'So',

    // --- training ---
    'Start workout': 'Workout starten', 'Last workout': 'Letztes Workout', 'Finish': 'Beenden',
    'No workouts logged yet. Start your first one – you can create exercises along the way.': 'Noch keine Workouts. Starte dein erstes – Übungen kannst du unterwegs anlegen.',
    '+ Add exercise': '+ Übung hinzufügen', 'Add exercise': 'Übung hinzufügen', 'Discard workout': 'Workout verwerfen',
    '+ Set': '+ Satz', '− Set': '− Satz', 'Delete workout': 'Workout löschen', 'No workout on this day.': 'An diesem Tag kein Workout.',
    'Editing – tap values to change them. Sets that aren’t ticked are removed when you tap Done.': 'Bearbeiten – tippe auf Werte, um sie zu ändern. Nicht abgehakte Sätze werden bei „Fertig“ entfernt.',
    'Swap exercise': 'Übung tauschen', 'Remove from workout': 'Aus Workout entfernen', 'Pin note': 'Notiz anheften',
    'Unpin note': 'Notiz lösen', 'Pin note – show every time': 'Notiz anheften – immer anzeigen',
    'Show it under this exercise in every workout until you unpin it.': 'Wird bei dieser Übung in jedem Workout angezeigt, bis du sie löst.',
    'Delete note': 'Notiz löschen', 'Edit note': 'Notiz bearbeiten', 'Add note': 'Notiz hinzufügen',
    'e.g. Seat height 4, grip shoulder-wide': 'z. B. Sitzhöhe 4, Griff schulterbreit',
    'No previous data': 'Keine früheren Daten', 'No earlier workout to compare': 'Kein früheres Workout zum Vergleich',
    'Stronger than last time': 'Stärker als letztes Mal', 'Weaker than last time': 'Schwächer als letztes Mal',
    'Same as last time': 'Gleich wie letztes Mal', 'New record': 'Neuer Rekord', 'Complete set': 'Satz abhaken',
    'Show history of this exercise': 'Verlauf dieser Übung anzeigen', 'Switch between e10RM and e1RM': 'Zwischen e10RM und e1RM wechseln',
    'Name workout': 'Workout benennen', 'Workout name': 'Workout-Name', 'Workout details': 'Workout-Details',
    'Previous month': 'Vorheriger Monat', 'Next month': 'Nächster Monat', 'Fewer sets': 'Weniger Sätze', 'More sets': 'Mehr Sätze',
    'Search or create new': 'Suchen oder neu anlegen', 'Nothing found – create it with the button above.': 'Nichts gefunden – leg sie mit dem Button oben an.',
    'Deload – not counted': 'Deload – zählt nicht', 'This week': 'Diese Woche', 'Last week': 'Letzte Woche',
    'Deleted exercise': 'Gelöschte Übung', 'Pick a value': 'Wert wählen',
    'Workout saved 💪': 'Workout gespeichert 💪', 'Workout deleted': 'Workout gelöscht', 'Changes saved': 'Änderungen gespeichert',
    'Note deleted': 'Notiz gelöscht', 'Note pinned': 'Notiz angeheftet', 'Note saved': 'Notiz gespeichert', 'Note removed': 'Notiz entfernt',
    'Note pinned – shows every time': 'Notiz angeheftet – wird immer angezeigt', 'Note unpinned': 'Notiz gelöst',
    'Enter a value': 'Gib einen Wert ein', 'Pick a duration': 'Wähle eine Dauer',
    'No sets completed yet. Discard this workout?': 'Noch keine Sätze abgehakt. Workout verwerfen?',
    'Discard workout? Everything logged in it will be lost.': 'Workout verwerfen? Alles darin Eingetragene geht verloren.',
    'No completed sets left. Delete this workout?': 'Keine abgehakten Sätze mehr. Workout löschen?',
    'Delete the last (completed) set?': 'Letzten (abgehakten) Satz löschen?', 'Couldn’t load that image': 'Bild konnte nicht geladen werden',
    'Saving failed: ': 'Speichern fehlgeschlagen: ',

    // --- exercise editor ---
    'Edit exercise': 'Übung bearbeiten', 'New exercise': 'Neue Übung', 'Delete exercise': 'Übung löschen',
    'Remove image': 'Bild entfernen', 'Image optional – camera or photo library': 'Bild optional – Kamera oder Fotos',
    'Which muscle does most of the work?': 'Welcher Muskel macht die Hauptarbeit?',
    'Which muscles assist? Pick as many as you like.': 'Welche Muskeln helfen mit? Wähle beliebig viele.',
    'Weight × Reps': 'Gewicht × Wdh.', 'Weight increment': 'Gewichtsschritte', 'e.g. Bench press': 'z. B. Bankdrücken',
    'Name is missing': 'Name fehlt', 'Pick a primary muscle': 'Wähle einen Primärmuskel',
    'That’s already the primary muscle': 'Das ist schon der Primärmuskel', 'Exercise history': 'Übungsverlauf',

    // --- muscles ---
    'Shoulders & neck': 'Schultern & Nacken', 'Torso': 'Rumpf', 'Arms': 'Arme', 'Legs': 'Beine',
    'Traps': 'Trapez', 'Front delts': 'Vordere Schulter', 'Side delts': 'Seitliche Schulter', 'Rear delts': 'Hintere Schulter',
    'Chest': 'Brust', 'Upper back': 'Oberer Rücken', 'Lats': 'Latissimus', 'Lower back': 'Unterer Rücken', 'Abs': 'Bauch',
    'Biceps': 'Bizeps', 'Triceps': 'Trizeps', 'Forearms': 'Unterarme', 'Glutes': 'Gesäß', 'Quads': 'Quadrizeps',
    'Hamstrings': 'Beinbeuger', 'Adductors': 'Adduktoren', 'Abductors': 'Abduktoren', 'Calves': 'Waden',
    'No primary muscle': 'Kein Primärmuskel',

    // --- equipment ---
    'Barbell': 'Langhantel', 'Dumbbell': 'Kurzhantel', 'Smith Machine': 'Multipresse', 'Machine': 'Maschine',
    'Cable': 'Kabelzug', 'Bodyweight': 'Körpergewicht', 'EZ Bar': 'SZ-Stange',

    // --- library exercises (name part before " · equipment") ---
    'Bench Press': 'Bankdrücken', 'Incline Bench Press': 'Schrägbankdrücken', 'Decline Bench Press': 'Negativbankdrücken',
    'Chest Press': 'Brustpresse', 'Incline Chest Press': 'Schräge Brustpresse', 'Chest Fly': 'Butterfly',
    'Incline Chest Fly': 'Schrägbank-Fliegende', 'Cable Fly': 'Fliegende am Kabel', 'Low-to-High Cable Fly': 'Fliegende von unten nach oben',
    'Push-up': 'Liegestütz', 'Chest Dip': 'Dips (Brust)', 'Deadlift': 'Kreuzheben', 'One-Arm Row': 'Einarmiges Rudern',
    'Chest-Supported Row': 'Rudern mit Brustauflage', 'Helms Row': 'Helms Row', 'T-Bar Row': 'T-Bar Rudern',
    'Seated Row': 'Rudern sitzend', 'Lat Pulldown': 'Latzug', 'Neutral-wide Lat Pulldown': 'Latzug weit mit Neutralgriff',
    'One-Arm Lat Pulldown': 'Einarmiger Latzug', 'Straight-Arm Pulldown': 'Pulldown mit gestreckten Armen', 'Pull-up': 'Klimmzug',
    'Chin-up': 'Klimmzug im Untergriff', 'Assisted Pull-up': 'Klimmzug mit Unterstützung', 'Pullover': 'Überzüge', 'Shrug': 'Shrugs',
    'Overhead Press': 'Schulterdrücken stehend', 'Shoulder Press': 'Schulterdrücken', 'Arnold Press': 'Arnold Press',
    'Lateral Raise': 'Seitheben', 'Reverse Fly': 'Reverse Butterfly', 'Reverse Cable Fly': 'Reverse Flys am Kabel', 'Face Pull': 'Face Pull',
    'Biceps Curl': 'Bizepscurls', 'Hammer Curl': 'Hammer Curls', 'Incline Curl': 'Schrägbank-Curls', 'Preacher Curl': 'Preacher Curls',
    'Concentration Curl': 'Konzentrationscurls', 'Bayesian Curl': 'Bayesian Curls', 'Triceps Pushdown': 'Trizepsdrücken',
    'Rope Pushdown': 'Trizepsdrücken mit Seil', 'Overhead Triceps Extension': 'Trizepsstrecken über Kopf', 'Skull Crusher': 'Stirndrücken',
    'Close-Grip Bench Press': 'Enges Bankdrücken', 'Triceps Kickback': 'Trizeps-Kickbacks', 'Triceps Extension': 'Trizepsstrecken',
    'Dead Hang': 'Hängen', 'Squat': 'Kniebeugen', 'Hack Squat': 'Hackenschmidt-Kniebeugen', 'Pendulum Squat': 'Pendel-Kniebeugen',
    'Goblet Squat': 'Goblet Squat', 'Leg Press': 'Beinpresse', 'Bulgarian Split Squat': 'Bulgarische Kniebeugen', 'Lunge': 'Ausfallschritte',
    'Walking Lunge': 'Gehende Ausfallschritte', 'Step-up': 'Step-ups', 'Leg Extension': 'Beinstrecken', 'Lying Leg Curl': 'Beinbeugen liegend',
    'Seated Leg Curl': 'Beinbeugen sitzend', 'Romanian Deadlift': 'Rumänisches Kreuzheben', 'Hyperextension': 'Hyperextensions',
    'Hip Thrust': 'Hip Thrust', 'Glute Kickback': 'Glute Kickbacks', 'Cable Pull-Through': 'Pull-Through am Kabel',
    'Hip Adduction': 'Adduktoren', 'Hip Abduction': 'Abduktoren', 'Standing Calf Raise': 'Wadenheben stehend',
    'Seated Calf Raise': 'Wadenheben sitzend', 'Calf Press': 'Wadenpresse', 'Crunch': 'Crunches', 'Cable Crunch': 'Crunches am Kabel',
    'Hanging Leg Raise': 'Beinheben hängend', 'Hanging Knee Raise': 'Knieheben hängend', 'Lying Leg Raise': 'Beinheben liegend',
    "Captain's Chair Leg Raise": 'Beinheben am Dip-Barren', 'Plank': 'Unterarmstütz', 'Side Plank': 'Seitstütz', 'Hollow Hold': 'Hollow Hold',
    // own exercises from the imports
    'High Row': 'Rudern von oben', 'Cross-Body Triceps Extension': 'Cross-Body Trizeps', 'Archer Pull': 'Bogenschütze',
    'Zottman Curl': 'Zottman Curls', 'Hammer Preacher Curl': 'Preacher Curls mit Hammergriff', 'Incline Shrug': 'Shrugs 30 Grad',

    // --- swap ---
    'Search any exercise': 'Beliebige Übung suchen', 'Sets move over to the new exercise': 'Sätze wandern zur neuen Übung',
    'No other exercise for this muscle yet – search below.': 'Noch keine andere Übung für diesen Muskel – such unten.',
    'This exercise has no primary muscle – search for a replacement.': 'Diese Übung hat keinen Primärmuskel – such einen Ersatz.',
    'Nothing found.': 'Nichts gefunden.',

    // --- plans ---
    'Choose a plan': 'Plan wählen', '+ Create a plan': '+ Plan erstellen', 'This plan has no workouts yet.': 'Dieser Plan hat noch keine Workouts.',
    'Edit plan': 'Plan bearbeiten', 'Make this the active plan': 'Als aktiven Plan setzen', 'No exercises yet.': 'Noch keine Übungen.',
    '+ Add workout': '+ Workout hinzufügen', 'Delete plan': 'Plan löschen', 'New plan': 'Neuer Plan', 'Active plan': 'Aktiver Plan',
    'No exercises in this workout yet.': 'Noch keine Übungen in diesem Workout.', 'Undo skip': 'Überspringen rückgängig',
    '70 % of 12RM × 12 · not counted': '70 % vom 12RM × 12 · zählt nicht', 'Finish your current workout first': 'Beende zuerst dein aktuelles Workout',
    'Deload: 70 % of your 12RM × 12 – just tick them off': 'Deload: 70 % deines 12RM × 12 – einfach abhaken',
    'Skip undone': 'Überspringen rückgängig gemacht', 'Plan deleted': 'Plan gelöscht', 'Plan options': 'Plan-Optionen', 'Plan name': 'Planname',
    'Move up': 'Nach oben', 'Move down': 'Nach unten', 'Skipped': 'Übersprungen',
    'Active plan · workouts run in this order, then start over': 'Aktiver Plan · Workouts laufen in dieser Reihenfolge, dann von vorn',

    // --- charts ---
    'Add chart': 'Diagramm hinzufügen', 'No charts yet. Add one to see how your lifts and training develop.': 'Noch keine Diagramme. Füg eins hinzu, um deine Entwicklung zu sehen.',
    'Time range': 'Zeitraum', 'Chart options': 'Diagramm-Optionen', 'Remove chart': 'Diagramm entfernen', 'Chart removed': 'Diagramm entfernt',
    'Shows a trend line over the chosen period and how much the value changed.': 'Zeigt eine Trendlinie über den gewählten Zeitraum und wie stark sich der Wert verändert hat.',
    'Create an exercise first': 'Leg zuerst eine Übung an', 'Choose exercise': 'Übung wählen', 'Trend: not enough data': 'Trend: zu wenig Daten',
    'Sets per muscle': 'Sätze pro Muskel', 'Primary muscle counts 1 set, secondary muscles ½. Deloads are not counted.': 'Primärmuskel zählt 1 Satz, Sekundärmuskeln ½. Deloads zählen nicht.',
    'No sets': 'Keine Sätze', 'Previous week': 'Vorherige Woche', 'Next week': 'Nächste Woche', 'All time': 'Gesamt',
    'Heaviest set': 'Schwerster Satz', 'Estimated 1RM (best set)': 'Geschätztes 1RM (bester Satz)', 'Estimated 10RM (best set)': 'Geschätztes 10RM (bester Satz)',
    'Volume (kg × reps)': 'Volumen (kg × Wdh.)', 'Most reps in a set': 'Meiste Wdh. in einem Satz', 'Best set': 'Bester Satz',
    'Most reps in a session': 'Meiste Wdh. in einer Einheit', 'Total reps': 'Wdh. gesamt', 'Most added weight': 'Meistes Zusatzgewicht', '+ kg optional': '+ kg optional', 'Longest set': 'Längster Satz',
    'Total time': 'Gesamtzeit', 'Workouts per week': 'Workouts pro Woche', 'Workout duration': 'Workout-Dauer',
    'Volume per workout': 'Volumen pro Workout', 'Sets per workout': 'Sätze pro Workout', 'No workouts in this time range.': 'Keine Workouts in diesem Zeitraum.',
    'No sets logged this week yet.': 'Diese Woche noch keine Sätze.', 'No sets logged in this week.': 'In dieser Woche keine Sätze.',
    '1 week': '1 Woche', '1 month': '1 Monat', '3 months': '3 Monate', '6 months': '6 Monate', '1 year': '1 Jahr',
    ' – from the set with the highest estimate in each workout': ' – aus dem Satz mit der höchsten Schätzung je Workout',

    // --- settings ---
    'Rest timer sound': 'Ton des Pausen-Timers', 'Normal': 'Normal', 'Even when silent': 'Auch lautlos',
    'Plays with the silent switch on – but pauses your music.': 'Spielt auch im Lautlos-Modus – pausiert aber deine Musik.',
    'Plays over your music, but not when the iPhone is on silent.': 'Spielt über deine Musik, aber nicht, wenn das iPhone lautlos ist.',
    'No sound – the timer only lights up.': 'Kein Ton – der Timer leuchtet nur auf.', 'Tap to test.': 'Tippen zum Testen.',
    'Language': 'Sprache', 'Account & sync': 'Konto & Sync', 'Backup file': 'Backup-Datei', 'Danger zone': 'Gefahrenzone',
    'A copy of all data as a file, e.g. for iCloud Drive. Importing merges: newer entries win.': 'Eine Kopie aller Daten als Datei, z. B. für iCloud Drive. Beim Import wird zusammengeführt: neuere Einträge gewinnen.',
    'Export backup': 'Backup exportieren', 'Import backup': 'Backup importieren', 'Wipe all data': 'Alle Daten löschen',
    'Signed in as': 'Angemeldet als', 'Sync now': 'Jetzt synchronisieren', 'Sign out': 'Abmelden', 'Sign in': 'Anmelden',
    'Enter the code we sent to': 'Gib den Code ein, den wir geschickt haben an', 'Use another email': 'Andere E-Mail verwenden',
    'Sign in to back up your training and sync it automatically.': 'Melde dich an, um dein Training zu sichern und automatisch zu synchronisieren.',
    'Send code': 'Code senden', 'Sending…': 'Wird gesendet…', 'Checking…': 'Wird geprüft…', 'Syncing…': 'Synchronisiere…',
    'Wrong or expired code.': 'Falscher oder abgelaufener Code.', 'Too many emails – try again in a while.': 'Zu viele E-Mails – versuch es später nochmal.',
    'Signed in – syncing': 'Angemeldet – synchronisiere', 'Nothing deleted': 'Nichts gelöscht', 'All data deleted': 'Alle Daten gelöscht',
    'All data deleted – also in the cloud': 'Alle Daten gelöscht – auch in der Cloud', 'Deleted here – the cloud follows on the next sync': 'Hier gelöscht – die Cloud folgt beim nächsten Sync',
    'Sign out? Your data stays on this device, but stops syncing.': 'Abmelden? Deine Daten bleiben auf diesem Gerät, werden aber nicht mehr synchronisiert.',
    'Saved on this device only': 'Nur auf diesem Gerät gespeichert', 'works offline.': 'funktioniert offline.',
    'Storage is protected – iOS won’t clear it.': 'Speicher ist geschützt – iOS löscht ihn nicht.',
    'iOS may clear storage when the iPhone runs low on space.': 'iOS kann den Speicher leeren, wenn das iPhone wenig Platz hat.',
    'Signed out – please sign in again': 'Abgemeldet – bitte neu anmelden', 'Not signed in': 'Nicht angemeldet',
    'Search name, equipment, muscle': 'Name, Gerät, Muskel suchen', 'Most trained': 'Am meisten trainiert', 'most trained': 'am meisten trainiert',
    'Personal records': 'Persönliche Rekorde', 'All-time best': 'Bestwert aller Zeiten', 'Deload – not compared': 'Deload – nicht verglichen',
    'Not trained yet. Sessions show up here once you log this exercise in a workout.': 'Noch nicht trainiert. Einheiten erscheinen hier, sobald du die Übung in einem Workout einträgst.',
    'Not a valid backup file': 'Keine gültige Backup-Datei', 'Not a Gym Log backup': 'Kein Gym-Log-Backup',
    'Nothing new in this backup': 'Nichts Neues in diesem Backup', 'Gym Log backup': 'Gym-Log-Backup',
    'Best e10RM': 'Bestes e10RM', 'Best e1RM': 'Bestes e1RM', 'Heaviest weight': 'Schwerstes Gewicht', 'Best session volume': 'Bestes Einheiten-Volumen',
    'Most time in a session': 'Meiste Zeit in einer Einheit',
    'sessions': 'Einheiten', 'first time': 'erstes Mal', 'secondary': 'sekundär', 'primary': 'primär', 'reps': 'Wdh.',
    'min : sec': 'Min : Sek', 'trained': 'trainiert', 'workouts': 'Workouts', 'set': 'Satz',

    // --- rest timer ---
    '15 seconds less': '15 Sekunden weniger', '15 seconds more': '15 Sekunden mehr', 'Skip rest': 'Pause überspringen', 'Rest is over': 'Pause vorbei',
  };

  // plural words: [one, many] -> German [one, many]
  const WORDS = {
    set: ['Satz', 'Sätze'], workout: ['Workout', 'Workouts'], exercise: ['Übung', 'Übungen'], entry: ['Eintrag', 'Einträge'],
    change: ['Änderung', 'Änderungen'], session: ['Einheit', 'Einheiten'], rep: ['Wdh.', 'Wdh.'], day: ['Tag', 'Tage'],
  };
  const word = (w, n) => { const k = w.replace(/s$/, ''); const de = WORDS[k] || WORDS[w]; return de ? de[n === 1 ? 0 : 1] : w; };

  // [regex, (match, t) => German]; t translates a part
  const PATTERNS = [
    [/^(\d+(?:[.,]\d+)?) (sets?|workouts?|exercises?|entries|entry|changes?|sessions?|reps?|days?)$/, (m) => `${m[1]} ${word(m[2], Number(m[1]))}`],
    [/^(\d+) (sets?|changes?) waiting$/, (m) => `${m[1]} ${word(m[2], +m[1])} ausstehend`],
    [/^(.+) added$/, (m, t) => `${t(m[1])} hinzugefügt`],
    [/^(.+) saved$/, (m, t) => `${t(m[1])} gespeichert`],
    [/^(.+) deleted$/, (m, t) => `${t(m[1])} gelöscht`],
    [/^(.+) skipped$/, (m, t) => `${t(m[1])} übersprungen`],
    [/^“(.+)” already exists$/, (m, t) => `„${t(m[1])}“ gibt es schon`],
    [/^(\d+) entr(?:y|ies) imported$/, (m) => `${m[1]} ${word('entry', +m[1])} importiert`],
    [/^Increment: (.+) kg$/, (m) => `Schritt: ${m[1]} kg`],
    [/^Workout (\d+|[A-Z])$/, (m) => `Workout ${m[1]}`],
    [/^Library · (\d+)$/, (m) => `Bibliothek · ${m[1]}`],
    [/^\+ Create “(.+)”$/, (m) => `+ „${m[1]}“ anlegen`],
    [/^Set (.+)$/, (m) => `Satz ${m[1]}`],
    [/^(Duration|Weight|Reps), set (\d+)$/, (m, t) => `${t(m[1])}, Satz ${m[2]}`],
    [/^Week of (.+)$/, (m) => `Woche vom ${m[1]}`],
    [/^week of (.+)$/, (m) => `Woche vom ${m[1]}`],
    [/^(.+) in (\d+) days$/, (m) => `${m[1]} in ${m[2]} Tagen`],
    [/^No (.+) logged in this time range\.$/, (m, t) => `Keine Einträge für ${t(m[1])} in diesem Zeitraum.`],
    [/^Last \((.+?)\) (.+)$/, (m) => `Zuletzt (${m[1]}) ${m[2]}`],
    [/^Last time (.*)$/, (m) => `Letztes Mal ${m[1]}`],
    [/^Last time$/, () => 'Letztes Mal'],
    [/^Best set: (.+) \((.+)\)$/, (m, t) => `Bester Satz: ${t(m[1])} (${t(m[2])})`],
    [/^Best (.+)$/, (m, t) => `Best ${t(m[1])}`],
    [/^Rest · (.+)$/, (m, t) => `Pause · ${t(m[1])}`],
    [/^Same muscle · (.+)$/, (m, t) => `Gleicher Muskel · ${t(m[1])}`],
    [/^Also works (.+)$/, (m, t) => `Trainiert auch ${t(m[1])}`],
    [/^Swapped to (.+)$/, (m, t) => `Getauscht gegen ${t(m[1])}`],
    [/^(.+): (\d+) sets? kept · rest on (.+)$/, (m, t) => `${t(m[1])}: ${m[2]} ${word('set', +m[2])} behalten · Rest auf ${t(m[3])}`],
    [/^Step size of the list for “(.*)”\. Saved per exercise\.$/, (m, t) => `Schrittweite der Liste für „${t(m[1])}“. Wird pro Übung gespeichert.`],
    [/^Edit “(.+)”$/, (m, t) => `„${t(m[1])}“ bearbeiten`],
    [/^Signed in as$/, () => 'Angemeldet als'],
    [/^All synced · last synced (.+)$/, (m) => `Alles synchronisiert · zuletzt ${m[1]}`],
    [/^(\d+) (changes?) waiting · (?:last synced (.+)|not synced yet)$/, (m) => `${m[1]} ${word(m[2], +m[1])} ausstehend · ${m[3] ? `zuletzt ${m[3]}` : 'noch nicht synchronisiert'}`],
    [/^Offline – (?:(\d+) (changes?) waiting|all changes synced)$/, (m) => `Offline – ${m[1] ? `${m[1]} ${word(m[2], +m[1])} ausstehend` : 'alles synchronisiert'}`],
    [/^Sync failed: (.+)$/, (m) => `Sync fehlgeschlagen: ${m[1]}`],
    [/^Gym Log v(.+)$/, (m) => `Gym Log v${m[1]}`],
    [/^You were signed out on (.+), (.+) \((.+)\)\. Sign in again – nothing on this device is lost\.$/, (m) => `Du wurdest am ${m[1]}, ${m[2]} abgemeldet (${m[3]}). Melde dich neu an – auf diesem Gerät geht nichts verloren.`],
    [/^Deletes all workouts, exercises, plans and charts( – on this device, in your cloud account and on your other signed-in devices| on this device)\. Settings like the timer sound stay\.$/,
      (m) => `Löscht alle Workouts, Übungen, Pläne und Diagramme ${m[1].includes('cloud') ? '– auf diesem Gerät, in deinem Cloud-Konto und auf deinen anderen angemeldeten Geräten' : 'auf diesem Gerät'}. Einstellungen wie der Timer-Ton bleiben.`],
    [/^This deletes all your training data (on this device AND in your cloud account \(all your devices\)|on this device)\. It can't be undone – export a backup first if you're unsure\.\n\nType DELETE to confirm\.$/,
      (m) => `Das löscht alle deine Trainingsdaten ${m[1].startsWith('on this device AND') ? 'auf diesem Gerät UND in deinem Cloud-Konto (alle deine Geräte)' : 'auf diesem Gerät'}. Das kann nicht rückgängig gemacht werden – exportiere vorher ein Backup, wenn du unsicher bist.\n\nTippe DELETE zum Bestätigen.`],
    [/^Delete “(.+)” from (.+)\?$/, (m, t) => `„${t(m[1])}“ vom ${m[2]} löschen?`],
    [/^Delete “(.+)” from the plan\?$/, (m, t) => `„${t(m[1])}“ aus dem Plan löschen?`],
    [/^Delete the plan “(.+)”\? Your logged workouts stay in History\.$/, (m, t) => `Plan „${t(m[1])}“ löschen? Deine Workouts bleiben im Verlauf.`],
    [/^Delete “(.+)”\?( Past workouts stay in your history\.)?$/, (m, t) => `„${t(m[1])}“ löschen?${m[2] ? ' Frühere Workouts bleiben im Verlauf.' : ''}`],
    [/^Remove “(.+)” from this workout\?$/, (m, t) => `„${t(m[1])}“ aus diesem Workout entfernen?`],
    [/^(\d+) (set is|sets are) not completed and won’t be saved\. Finish anyway\?$/, (m) => `${m[1]} ${+m[1] === 1 ? 'Satz ist' : 'Sätze sind'} nicht abgehakt und ${+m[1] === 1 ? 'wird' : 'werden'} nicht gespeichert. Trotzdem beenden?`],
    [/^(\d+) (completed sets? stays?)(.*)$/, (m) => `${m[1]} ${+m[1] === 1 ? 'abgehakter Satz bleibt' : 'abgehakte Sätze bleiben'}${m[3]}`],
    [/^Skip( \(and continue after it\))?$/, (m) => `Überspringen${m[1] ? ' (und danach weitermachen)' : ''}`],
    [/^Nothing found\. Tap \+ to create it\.$/, () => 'Nichts gefunden. Tippe auf +, um sie anzulegen.'],
    [/^(\d+) min$/, (m) => `${m[1]} Min.`],
    [/^(\d+) h(?: (\d+) min)?$/, (m) => `${m[1]} Std.${m[2] ? ` ${m[2]} Min.` : ''}`],
    [/^([+−±])(\d+) (reps?)$/, (m) => `${m[1]}${m[2]} ${word(m[3], +m[2])}`],
    [/^(.+) vs (.+)$/, (m, t) => `${t(m[1])} vs. ${m[2]}`],
    [/^Not trained: (.+)$/, (m, t) => `Nicht trainiert: ${t(m[1])}`],
    [/^(.+) chart$/, (m, t) => `Diagramm ${t(m[1])}`],
    [/^(.+) – from the set with the highest estimate in each workout$/, (m, t) => `${t(m[1])} – aus dem Satz mit der höchsten Schätzung je Workout`],
    [/^(.+) Tap to test\.$/, (m, t) => `${t(m[1])} Tippen zum Testen.`],
    [/^· works offline\. (.+)$/, (m, t) => `· funktioniert offline. ${t(m[1])}`],
    [/^\+ (.+)$/, (m, t) => `+ ${t(m[1])}`],
    [/^since (.+?)( ·)?$/, (m) => `seit ${m[1]}${m[2] || ''}`],
    [/^Last (.+)$/, (m) => `Zuletzt ${m[1]}`],
    [/^(\d+)×$/, (m) => `${m[1]}×`],
  ];

  const misses = new Set(), made = new Set();
  const letters = /[A-Za-z]/;

  /** German for an English text (or the text itself). */
  function t(text) {
    if (lang !== 'de' || text == null) return text;
    const s = String(text), core = s.trim();
    if (!core || made.has(core) || !letters.test(core.replace(/\b(e?\d*RM|kg|min)\b/g, ''))) return s; // numbers, units
    const lead = s.slice(0, s.indexOf(core)), tail = s.slice(s.indexOf(core) + core.length);
    const out = translateCore(core);
    if (out == null) { misses.add(core); return s; }
    made.add(out);
    return lead + out + tail;
  }
  function translateCore(core) {
    if (Object.hasOwn(DE, core)) return DE[core];
    for (const [re, fn] of PATTERNS) {
      const m = core.match(re);
      if (m) return fn(m, (x) => t(x));
    }
    for (const sep of [' · ', ', ', ' + ']) {
      if (!core.includes(sep)) continue;
      const parts = core.split(sep), tr = parts.map((p) => t(p));
      if (tr.some((x, i) => x !== parts[i])) return tr.join(sep);
    }
    return null;
  }

  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const skip = (el) => el?.closest?.('[translate="no"], script, style, textarea');
  function walk(root) {
    if (root.nodeType === 3) { if (!skip(root.parentElement)) { const v = t(root.data); if (v !== root.data) root.data = v; } return; }
    if (root.nodeType !== 1 || skip(root)) return;
    for (const a of ATTRS) if (root.hasAttribute(a)) { const v = t(root.getAttribute(a)); if (v !== root.getAttribute(a)) root.setAttribute(a, v); }
    for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
  }

  if (lang === 'de') {
    document.documentElement.lang = 'de';
    const start = () => {
      walk(document.body);
      new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === 'characterData') walk(r.target);
          else if (r.type === 'attributes') {
            const el = r.target, v = el.getAttribute(r.attributeName);
            if (v != null && !skip(el)) { const n = t(v); if (n !== v) el.setAttribute(r.attributeName, n); }
          } else r.addedNodes.forEach(walk);
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
    const nativeConfirm = window.confirm.bind(window), nativePrompt = window.prompt.bind(window);
    window.confirm = (msg) => nativeConfirm(t(msg));
    window.prompt = (msg, def) => nativePrompt(t(msg), def);
  }

  return {
    lang, t, misses,
    /** Switch language (reloads, so every view is built again). */
    set(l) { localStorage.setItem(KEY, l); location.reload(); },
    /** Locale for dates and numbers. */
    locale: lang === 'de' ? 'de-DE' : 'en-GB',
  };
})();
