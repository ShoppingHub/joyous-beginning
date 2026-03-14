export type Locale = "en" | "it";

const translations = {
  // App
  "app.tagline": { en: "Observe your direction.", it: "Osserva la tua direzione." },

  // Bottom nav
  "nav.home": { en: "Home", it: "Home" },
  "nav.areas": { en: "Areas", it: "Aree" },
  "nav.activities": { en: "Activities", it: "Attività" },
  "nav.progress": { en: "Progress", it: "Progress" },
  "nav.finance": { en: "Finance", it: "Finanze" },
  "nav.settings": { en: "Settings", it: "Impostazioni" },

  // Login
  "login.title": { en: "opad.me", it: "opad.me" },
  "login.tab.login": { en: "Log in", it: "Accedi" },
  "login.tab.signup": { en: "Sign up", it: "Registrati" },
  "login.email.placeholder": { en: "your@email.com", it: "tua@email.com" },
  "login.password.placeholder": { en: "Password", it: "Password" },
  "login.password.create": { en: "Create a password (min 6 chars)", it: "Crea una password (min 6 caratteri)" },
  "login.button.login": { en: "Log in", it: "Accedi" },
  "login.button.signup": { en: "Create account", it: "Crea account" },
  "login.forgot": { en: "Forgot password?", it: "Password dimenticata?" },
  "login.or": { en: "or", it: "oppure" },
  "login.google": { en: "Continue with Google", it: "Continua con Google" },
  "login.demo": { en: "Try demo without an account", it: "Prova la demo senza un account" },
  "login.error.email": { en: "Please enter a valid email address.", it: "Inserisci un indirizzo email valido." },
  "login.error.password.short": { en: "Password must be at least 6 characters.", it: "La password deve avere almeno 6 caratteri." },
  "login.error.password.empty": { en: "Please enter your password.", it: "Inserisci la tua password." },
  "login.error.invalid": { en: "Invalid email or password.", it: "Email o password non validi." },
  "login.error.exists": { en: "An account with this email already exists. Try logging in.", it: "Esiste già un account con questa email. Prova ad accedere." },
  "login.error.generic": { en: "Something went wrong. Please try again.", it: "Qualcosa è andato storto. Riprova." },
  "login.error.google": { en: "Google login failed. Please try again.", it: "Accesso con Google non riuscito. Riprova." },

  // Check email
  "checkEmail.title": { en: "Check your email", it: "Controlla la tua email" },
  "checkEmail.sent": { en: "We sent a verification link to", it: "Abbiamo inviato un link di verifica a" },
  "checkEmail.resend": { en: "Didn't get it? Send again", it: "Non l'hai ricevuta? Invia di nuovo" },
  "checkEmail.sending": { en: "Sending...", it: "Invio in corso..." },
  "checkEmail.back": { en: "Back to login", it: "Torna al login" },

  // Forgot password
  "forgot.title": { en: "Reset password", it: "Reimposta password" },
  "forgot.description": { en: "Enter your email and we'll send you a reset link.", it: "Inserisci la tua email e ti invieremo un link per reimpostare." },
  "forgot.sent": { en: "Check your email for a reset link.", it: "Controlla la tua email per il link di reimpostazione." },
  "forgot.button": { en: "Send reset link", it: "Invia link di reimpostazione" },
  "forgot.back": { en: "Back to login", it: "Torna al login" },

  // Reset password
  "reset.title": { en: "Set new password", it: "Imposta nuova password" },
  "reset.description": { en: "Choose a new password for your account.", it: "Scegli una nuova password per il tuo account." },
  "reset.placeholder": { en: "New password (min 6 chars)", it: "Nuova password (min 6 caratteri)" },
  "reset.confirm": { en: "Confirm new password", it: "Conferma nuova password" },
  "reset.button": { en: "Update password", it: "Aggiorna password" },
  "reset.success.title": { en: "Password updated", it: "Password aggiornata" },
  "reset.success.redirect": { en: "Redirecting…", it: "Reindirizzamento…" },
  "reset.error.short": { en: "Password must be at least 6 characters.", it: "La password deve avere almeno 6 caratteri." },
  "reset.error.mismatch": { en: "Passwords do not match.", it: "Le password non coincidono." },
  "reset.error.generic": { en: "Something went wrong. Please try again.", it: "Qualcosa è andato storto. Riprova." },
  "reset.expired.text": { en: "This link has expired or is invalid.", it: "Questo link è scaduto o non è valido." },
  "reset.expired.back": { en: "Back to login", it: "Torna al login" },

  // Settings
  "settings.title": { en: "Settings", it: "Impostazioni" },
  "settings.preferences": { en: "Preferences", it: "Preferenze" },
  "settings.language": { en: "Language", it: "Lingua" },
  "settings.showScore": { en: "Show trajectory score", it: "Mostra punteggio traiettoria" },
  "settings.notifications": { en: "Notifications", it: "Notifiche" },
  "settings.demo.title": { en: "Demo mode", it: "Modalità demo" },
  "settings.demo.description": { en: "You're exploring without an account", it: "Stai esplorando senza un account" },
  "settings.demo.exit": { en: "Exit", it: "Esci" },
  "settings.account": { en: "Account", it: "Account" },
  "settings.signOut": { en: "Sign out", it: "Esci" },
  "settings.deleteAccount": { en: "Delete account", it: "Elimina account" },
  "settings.deleteDialog.title": { en: "Delete account", it: "Elimina account" },
  "settings.deleteDialog.description": { en: "This will permanently delete all your observation history. This cannot be undone.", it: "Questo eliminerà permanentemente tutta la tua cronologia di osservazioni. Non può essere annullato." },
  "settings.deleteDialog.confirm": { en: "Delete permanently", it: "Elimina definitivamente" },
  "settings.deleteDialog.cancel": { en: "Cancel", it: "Annulla" },
  "settings.deleteError": { en: "Something went wrong. Please try again.", it: "Qualcosa è andato storto. Riprova." },

  // Dashboard / Index
  "dashboard.empty.title": { en: "What do you want to observe?", it: "Cosa vuoi osservare?" },
  "dashboard.empty.description": { en: "Add a life area to start seeing your trajectory.", it: "Aggiungi un'area per iniziare a vedere la tua traiettoria." },
  "dashboard.empty.button": { en: "Add your first area", it: "Aggiungi la tua prima area" },

  // Home hub
  "home.empty.title": { en: "What do you want to observe?", it: "Cosa vuoi osservare?" },
  "home.empty.description": { en: "Add an area in Activities to start observing.", it: "Aggiungi un'area in Attività per iniziare." },
  "home.empty.button": { en: "Go to Activities", it: "Vai ad Attività" },
  "home.allLogged": { en: "All logged for this day.", it: "Tutto registrato per questo giorno." },
  "home.cta.done": { en: "Done", it: "Fatto" },
  "home.cta.observed": { en: "Observed ✓", it: "Osservato ✓" },
  "home.cta.openSession": { en: "Open session", it: "Apri scheda" },
  "home.undo.confirm": { en: "Undo?", it: "Annullare?" },
  "home.undo.yes": { en: "Yes", it: "Sì" },
  "home.undo.no": { en: "No", it: "No" },
  "home.note.save": { en: "Save", it: "Salva" },

  "dashboard.error": { en: "Something went wrong. Please try again.", it: "Qualcosa è andato storto. Riprova." },
  "dashboard.filter.all": { en: "All", it: "Tutto" },
  "dashboard.emptyFilter": { en: "No data for this category yet.", it: "Nessun dato per questa categoria." },

  // Trajectory card
  "card.observed": { en: "Observed", it: "Osservato" },
  "card.logToday": { en: "Log today", it: "Registra oggi" },

  // Area detail
  "areaDetail.notFound": { en: "Area not found.", it: "Area non trovata." },
  "areaDetail.editArea": { en: "Edit area", it: "Modifica area" },
  "areaDetail.emptyGraph": { en: "Keep observing. Your trajectory takes shape over days.", it: "Continua a osservare. La tua traiettoria prende forma nel tempo." },
  "areaDetail.score": { en: "Trajectory score", it: "Punteggio traiettoria" },

  // Area form
  "areaForm.add.title": { en: "Add area", it: "Aggiungi area" },
  "areaForm.edit.title": { en: "Edit area", it: "Modifica area" },
  "areaForm.namePlaceholder": { en: "e.g. Morning walk", it: "es. Camminata mattutina" },
  "areaForm.typeError": { en: "Please select a type", it: "Seleziona un tipo" },
  "areaForm.frequency": { en: "How many days per week?", it: "Quanti giorni a settimana?" },
  "areaForm.add.button": { en: "Start observing", it: "Inizia a osservare" },
  "areaForm.edit.button": { en: "Save changes", it: "Salva modifiche" },
  "areaForm.archive": { en: "Archive area", it: "Archivia area" },
  "areaForm.error": { en: "Something went wrong. Please try again.", it: "Qualcosa è andato storto. Riprova." },

  // Area types
  "areaType.health": { en: "Health", it: "Salute" },
  "areaType.study": { en: "Study", it: "Studio" },
  "areaType.reduce": { en: "Reduce", it: "Ridurre" },
  "areaType.finance": { en: "Finance", it: "Finanza" },

  // Finance
  "finance.title": { en: "Finance", it: "Finanza" },
  "finance.empty": { en: "Log your first finance check-in to see your trend.", it: "Registra il tuo primo check-in finanziario per vedere il trend." },
  "finance.addArea": { en: "Add Finance area", it: "Aggiungi area Finanza" },
  "finance.projection": { en: "30-day estimate based on your current trend.", it: "Stima a 30 giorni basata sul tuo trend attuale." },

  // Onboarding
  "onboarding.areas.title": { en: "What do you want to observe?", it: "Cosa vuoi osservare?" },
  "onboarding.areas.preset.morning": { en: "Morning movement", it: "Movimento mattutino" },
  "onboarding.areas.preset.reading": { en: "Daily reading", it: "Lettura quotidiana" },
  "onboarding.areas.preset.screen": { en: "Less screen time", it: "Meno tempo schermo" },
  "onboarding.areas.preset.saving": { en: "Monthly saving", it: "Risparmio mensile" },
  "onboarding.areas.addCustom": { en: "Add custom", it: "Aggiungi personalizzata" },
  "onboarding.areas.addButton": { en: "Add", it: "Aggiungi" },
  "onboarding.areas.namePlaceholder": { en: "Area name", it: "Nome area" },
  "onboarding.areas.continue": { en: "Continue", it: "Continua" },
  "onboarding.frequency.title": { en: "How many days per week?", it: "Quanti giorni a settimana?" },
  "onboarding.frequency.button": { en: "Start observing", it: "Inizia a osservare" },

  // Auth callback
  "authCallback.error": { en: "Something went wrong. Please try again.", it: "Qualcosa è andato storto. Riprova." },

  // 404
  "notFound.title": { en: "404", it: "404" },
  "notFound.message": { en: "Oops! Page not found", it: "Oops! Pagina non trovata" },
  "notFound.link": { en: "Return to Home", it: "Torna alla Home" },

  // Areas page
  "areas.title": { en: "Activities", it: "Attività" },
  "areas.section.health": { en: "Health", it: "Salute" },
  "areas.section.study": { en: "Study", it: "Studio" },
  "areas.section.reduce": { en: "Reduce", it: "Riduci" },
  "areas.section.finance": { en: "Finance", it: "Finanze" },
  "areas.add": { en: "+ Add", it: "+ Aggiungi" },

  // Finance toggle
  "settings.financeTab": { en: "Show Finance tab", it: "Mostra sezione Finanze" },
  "settings.financeTabSub": { en: "Adds quick access to the finance projection.", it: "Aggiunge un accesso rapido alla proiezione finanziaria." },

  // Progress
  "progress.empty.title": { en: "No data yet.", it: "Nessun dato ancora." },
  "progress.empty.description": { en: "Add an area in Activities and start logging.", it: "Aggiungi un'area in Attività e inizia a registrare." },
  "progress.empty.button": { en: "Go to Activities", it: "Vai ad Attività" },

  "gym.title": { en: "Gym Card", it: "Scheda Palestra" },
  "gym.todaySession": { en: "Today's session", it: "Sessione di oggi" },
  "gym.empty": { en: "No exercises yet", it: "Nessun esercizio ancora" },
  "gym.addExercise": { en: "Add exercise", it: "Aggiungi esercizio" },
  "gym.editExercise": { en: "Edit exercise", it: "Modifica esercizio" },
  "gym.history": { en: "Session history", it: "Storico sessioni" },
  "gym.exercises": { en: "exercises", it: "esercizi" },
  "gym.sets": { en: "sets", it: "serie" },
  "gym.reps": { en: "reps", it: "rip" },
  "gym.form.name": { en: "Name", it: "Nome" },
  "gym.form.namePlaceholder": { en: "e.g. Bench press", it: "es. Panca piana" },
  "gym.form.sets": { en: "Sets", it: "Serie" },
  "gym.form.reps": { en: "Reps", it: "Rip" },
  "gym.form.weight": { en: "Weight (kg)", it: "Peso (kg)" },
  "gym.form.weightPlaceholder": { en: "Optional", it: "Opzionale" },
  "gym.form.notes": { en: "Notes", it: "Note" },
  "gym.form.notesPlaceholder": { en: "Optional", it: "Opzionale" },
  "gym.form.save": { en: "Save", it: "Salva" },
  "gym.form.delete": { en: "Delete", it: "Elimina" },
  "gym.form.cancel": { en: "Cancel", it: "Annulla" },

  // Gym Wizard
  "gym.wizard.title": { en: "Set up your workout plan", it: "Configura la tua scheda" },
  "gym.wizard.subtitle": { en: "Create the structure of your weekly workouts.", it: "Crea la struttura dei tuoi allenamenti settimanali." },
  "gym.wizard.cta": { en: "Get started", it: "Inizia" },
  "gym.wizard.howManyDays": { en: "How many training days?", it: "Quanti giorni di allenamento?" },
  "gym.wizard.createPlan": { en: "Create plan", it: "Crea scheda" },

  // Gym Plan Editor
  "gym.plan.title": { en: "Plan", it: "Scheda" },
  "gym.plan.edit": { en: "Edit plan", it: "Modifica scheda" },
  "gym.plan.addGroup": { en: "Add muscle group", it: "Aggiungi gruppo muscolare" },
  "gym.plan.groupPlaceholder": { en: "e.g. Legs", it: "es. Gambe" },
  "gym.plan.deactivate": { en: "Deactivate exercise", it: "Disattiva esercizio" },
  "gym.daily": { en: "Daily", it: "Giornalieri" },
  "gym.dailySub": { en: "Appears in every session", it: "Appare in ogni sessione" },

  // Gym Session
  "gym.session.noExercises": { en: "No active exercises for this day", it: "Nessun esercizio attivo per questo giorno" },
  "gym.session.noExercisesSub": { en: "Add exercises from Edit plan", it: "Aggiungi esercizi dalla modifica scheda" },
  "gym.session.selectDay": { en: "Select day", it: "Seleziona giorno" },

  // Reduce tracking
  "reduce.trackingLabel": { en: "How do you want to track this?", it: "Come vuoi tracciare?" },
  "reduce.modeBinary": { en: "Simple (done / not done)", it: "Semplice (fatto / non fatto)" },
  "reduce.modeQuantity": { en: "Count occurrences", it: "Conta occorrenze" },
  "reduce.unitLabelLabel": { en: "What are you counting?", it: "Cosa stai contando?" },
  "reduce.unitLabelPlaceholder": { en: "e.g. cigarettes", it: "es. sigarette" },
  "reduce.baselineLabel": { en: "Typical daily amount (your starting reference)", it: "Quantità giornaliera tipica (riferimento iniziale)" },
  "reduce.baselinePlaceholder": { en: "e.g. 10", it: "es. 10" },
  "reduce.unitLabelError": { en: "Please add a unit label", it: "Aggiungi un'etichetta" },
  "reduce.baselineError": { en: "Please enter a starting quantity", it: "Inserisci una quantità iniziale" },
  "reduce.showQuickAdd": { en: "Show quick-add on Home", it: "Mostra contatore rapido in Home" },
  "reduce.recorded": { en: "recorded", it: "registrato" },
  "reduce.today": { en: "today", it: "oggi" },

  // Home - no scheduled activities
  "home.noScheduled": { en: "No activities scheduled for this day.", it: "Nessuna attività programmata per questo giorno." },
} as const;

export type TranslationKey = keyof typeof translations;

export function getTranslation(key: TranslationKey, locale: Locale): string {
  const entry = translations[key];
  return entry[locale] ?? entry["en"];
}

export default translations;
