

# Redesign sessione palestra — UX dedicata all'allenamento

## Problema
La pagina sessione (`/cards/gym`) attualmente:
1. Mostra tab per navigare tra i giorni, creando confusione con la pagina di gestione piano
2. Gli esercizi completati usano una checkbox + opacity ridotta, identica alla vista della scheda generale — non c'e distinzione visiva tra "sessione attiva" e "vista piano"

## Soluzione

Ripensare `/cards/gym` come **pagina sessione pura**: l'utente entra, vede solo il giorno assegnato, e interagisce con mini-card esercizio ottimizzate per l'allenamento.

### Cosa cambia

**1. Rimuovere la navigazione tra giorni**
- Eliminare completamente i tab/pill dei giorni
- Il sistema seleziona automaticamente il giorno corretto (rotazione ciclica, come già implementato)
- Mostrare solo un'etichetta read-only in alto: "Giorno A" (o il nome del giorno)

**2. Rimuovere weekly summary e history dalla sessione**
- Il riepilogo settimanale e lo storico rimangono solo in `/cards/gym/edit`
- La sessione diventa minimale: header, label giorno, lista esercizi, back

**3. Nuovo design esercizio — mini-card stile Home**
Ogni esercizio diventa una mini-card `rounded-xl bg-card p-3` con layout simile alle ActivityCard della Home ma compatto:

```text
┌─────────────────────────────────────┐
│  Squat                    4×80kg ✏️ │
│                          [  ✓  ]   │
└─────────────────────────────────────┘
```

- **Riga superiore**: nome esercizio a sinistra, dettaglio peso/reps a destra con icona edit
- **Riga inferiore o area destra**: bottone "Done" (stile simile al check della Home — bordo + check icon)
- Quando completato: il bottone diventa filled (bg-primary/20 + text-primary), ma **il testo dell'esercizio resta leggibile** (no opacity-50 sull'intera card, solo il bottone cambia stato)
- Tap su area peso/reps: espande inline l'editor peso (come ora, con input numerico)

**4. Struttura finale della pagina sessione**

```text
┌──────────────────────────────┐
│  ←    🏋️ Scheda Palestra  ⚙️  │  ← header (invariato)
├──────────────────────────────┤
│  Giorno A                    │  ← label read-only, non cliccabile
├──────────────────────────────┤
│  ── Giornalieri ──           │  ← sezione daily (se presenti)
│  [mini-card Plank]           │
│  [mini-card Crunch]          │
│  ── Gambe ──                 │  ← gruppi muscolari
│  [mini-card Squat]           │
│  [mini-card Leg press]       │
└──────────────────────────────┘
```

### File coinvolti

| File | Modifica |
|---|---|
| `src/pages/GymCardPage.tsx` | Rimuovere tab giorni, weekly summary, history. Redesign `SessionExerciseRow` come mini-card. Giorno mostrato come label read-only. |

### Dettagli tecnici

- La logica di selezione automatica del giorno resta identica (rotazione ciclica basata su ultima sessione)
- La logica di toggle esercizio, auto check-in, edit peso resta identica
- Cambia solo il rendering: no tab, no history, mini-card per esercizi
- Gli esercizi completati cambiano solo lo stile del bottone Done (filled), senza ridurre opacity dell'intera riga — differenziazione chiara dalla vista piano dove la checkbox + opacity indica lo stato nella scheda generale

