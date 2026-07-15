import type { SummaryTemplatesMap } from '../../types/summary-prompt.types'

export const SUMMARY_TEMPLATES_EN: SummaryTemplatesMap = {
  weekly: `##### Week {week} Summary — {month}/{year}

###### 📅 Period
- **Date range**: {start} to {end}

###### 🎯 Core keywords this week
**Keyword 1**, **Keyword 2**, **Keyword 3**

---

###### 👥 Key people & relationship progress
- **(Person 1)**:
- **(Person 2)**:

---

###### 🎞️ Key events (timeline)
- **【Event title】**
    - **Details**:
    - **Significance**:

---

###### 💡 Reflections & mindset shifts
- **Work / technology**:
- **Life / self**:

---

###### 📊 State check-in
- **Energy**:
- **Regrets this week**:
- **Next week focus**:

---
###### 🍵 Capsule for monthly summary
> (one-sentence summary)`,
  monthly: `##### {month}/{year} Monthly Summary

###### 📅 Date range
- **Range**: {start} to {end}

###### 🎯 Core themes this month
**Theme 1**, **Theme 2**

---

###### 📈 Key progress & achievements
- **Work / technology**:
- **Life / personal**:

---

###### 👥 Relationship dynamics
- **(Person 1)**:
- **(Person 2)**:

---

###### 💡 Deeper reflection

---

###### 📊 State check-in (0–10)
- **State**:
- **Satisfaction**:

---
###### 🔮 Next month outlook
- **Focus**:`,
  quarterly: `##### Q{quarter} {year} Quarterly Summary

###### 📅 Date range
- **Range**: {start} to {end}

###### 🏆 Quarterly milestones
1. 
2. 

---

###### 🌊 Trend review
- **Rising trends**:
- **Declining trends**:

---

###### 👥 Long-term relationships

---

###### 💡 Quarterly insights

---

###### 🧭 Next quarter priorities
- **Core direction**:`,
  yearly: `# {year} Year in Review: (one word for the year)

###### 📅 Date range
- **Range**: {start} to {end}

---

###### 🌟 Highlights of the year
1. 
2. 

---

###### 🗺️ Life trajectory
- **Q1**:
- **Q2**:
- **Q3**:
- **Q4**:

---

###### 👥 Important relationships this year

---

###### 🪴 Growth & awakening

---

###### 💌 Letter to your future self
> `
}
