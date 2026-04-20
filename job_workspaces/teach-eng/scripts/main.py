#!/usr/bin/env python3
"""teach-eng: Online English teaching toolkit — lesson planner & platform guide."""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / "config" / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False

BASE_DIR = Path(__file__).parent.parent
LOGS_DIR = BASE_DIR / os.getenv("OUTPUT_DIR", "logs")
LOGS_DIR.mkdir(exist_ok=True)
DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"

PLATFORMS = [
    {"name": "Cambly",      "rate": "$10–12/hr", "commission": "None (fixed)", "degree": "No", "tefl": "No",  "approval": "Days",   "url": "https://www.cambly.com/tutor"},
    {"name": "iTalki",      "rate": "$15–30/hr", "commission": "15%",          "degree": "No", "tefl": "Optional", "approval": "1 wk", "url": "https://www.italki.com/teacher"},
    {"name": "Preply",      "rate": "$12–79/hr", "commission": "15–33%",       "degree": "No", "tefl": "Preferred","approval": "1–2 wk","url": "https://preply.com/en/teach"},
    {"name": "VIPKid",      "rate": "$14–22/hr", "commission": "None (fixed)", "degree": "Yes","tefl": "Optional", "approval": "1 wk", "url": "https://www.vipkid.com/teacher"},
    {"name": "Magic Ears",  "rate": "Up to $26/hr","commission":"None (fixed)","degree": "Yes","tefl": "Preferred","approval": "1 wk","url": "https://www.magicears.com.cn"},
    {"name": "Verbling",    "rate": "$40–100+/hr","commission": "~20%",        "degree": "No", "tefl": "Yes",  "approval": "1–2 wk","url": "https://www.verbling.com/teach"},
]

LESSON_TEMPLATES = {
    "kids": {
        "beginner": {
            "warm_up": "Greeting + review game (jump/clap for yes/no) — 5 min",
            "intro": "Flashcard drill — show picture, chorus repeat 3x — 5 min",
            "practice": "Picture matching game: match word cards to image cards — 7 min",
            "break": "Action song (Head Shoulders Knees and Toes or similar) — 3 min",
            "free_practice": "Q&A: point to flashcard, ask 'What is it?' student answers — 8 min",
            "wrap_up": "Review: quick fire round + praise + goodbye song — 5 min",
        },
        "intermediate": {
            "warm_up": "Story recap or 'What did we learn last time?' quiz — 5 min",
            "intro": "New vocab in context (short story/dialogue) — 7 min",
            "practice": "Fill-in-the-blank worksheet or game — 8 min",
            "break": "Movement activity: act out vocab words — 3 min",
            "free_practice": "Role-play scenario using new vocabulary — 10 min",
            "wrap_up": "Mini quiz + specific praise + preview next lesson — 5 min",
        },
        "advanced": {
            "warm_up": "Conversation starter: 'Tell me about your weekend' — 5 min",
            "intro": "Idioms or complex grammar with examples — 7 min",
            "practice": "Storytelling: student tells story using target language — 10 min",
            "break": "Tongue twister challenge — 2 min",
            "free_practice": "Debate or describe a picture using new language — 12 min",
            "wrap_up": "Self-assessment: 'What was hard today?' + homework suggestion — 5 min",
        },
    },
    "adults": {
        "beginner": {
            "warm_up": "Introduce yourself Q&A — 5 min",
            "intro": "Target grammar: present simple + vocabulary set — 10 min",
            "practice": "Fill-in-the-blank exercises — 10 min",
            "break": "Pronunciation drill — 5 min",
            "free_practice": "Short conversation using lesson vocabulary — 10 min",
            "wrap_up": "Error correction review + next steps — 5 min",
        },
        "intermediate": {
            "warm_up": "Discussion question on current topic — 5 min",
            "intro": "Grammar point with real examples — 8 min",
            "practice": "Error correction game or gap fill — 10 min",
            "break": "Pronunciation focus — 3 min",
            "free_practice": "Role-play: workplace or social scenario — 12 min",
            "wrap_up": "Feedback + vocabulary review — 5 min",
        },
        "advanced": {
            "warm_up": "News discussion or opinion question — 7 min",
            "intro": "Idiomatic expressions or complex grammar — 8 min",
            "practice": "Text analysis + paraphrase exercise — 10 min",
            "break": "Pronunciation of difficult words — 3 min",
            "free_practice": "Debate or presentation — 15 min",
            "wrap_up": "Corrections + resources recommendation — 5 min",
        },
    },
}

ACTIVITY_TEMPLATES = {
    "qa": {
        "kids": [
            "What color is the [object]?",
            "How many [objects] are there?",
            "Is this a [noun] or a [noun]?",
            "Where is the [animal]? — on, under, next to",
            "What does a [animal] eat?",
        ],
        "adults": [
            "What do you do on weekends?",
            "How long have you been studying English?",
            "What would you do if you won the lottery?",
            "What's the difference between [word A] and [word B]?",
            "Can you explain [concept] in your own words?",
        ],
    },
    "matching": {
        "kids": [
            "Match the animal picture to its name",
            "Match the word to the correct color",
            "Match the action verb to its picture (run, jump, swim)",
            "Match the food to the meal (breakfast/lunch/dinner)",
            "Match the number to the group of objects",
        ],
        "adults": [
            "Match the idiom to its meaning",
            "Match the formal word to its informal equivalent",
            "Match the job title to the job description",
            "Match the phrasal verb to its definition",
            "Match the country to its capital and language",
        ],
    },
    "roleplay": {
        "kids": [
            "At a birthday party: greet friends, sing happy birthday",
            "At a restaurant: order food, ask for the bill",
            "At school: ask teacher for help, answer questions",
            "At a toy shop: ask for a toy, say thank you",
            "At the doctor: describe what hurts, follow instructions",
        ],
        "adults": [
            "Job interview: introduce yourself, answer competency questions",
            "Business meeting: present an idea, handle objections",
            "Phone call: make a complaint, ask for a refund",
            "At the airport: check in, go through security, ask for help",
            "Doctor's appointment: describe symptoms, ask questions",
        ],
    },
    "fillblank": {
        "kids": [
            "The cat is ___ (sleeping/running). [picture clue]",
            "I ___ (like/likes) ice cream.",
            "There are ___ apples in the basket. [picture: 5 apples]",
            "She ___ (go/goes) to school every day.",
            "The dog is ___ (big/small) — [picture shows big dog]",
        ],
        "adults": [
            "She ___ (has been/was) working here since 2020.",
            "If I ___ (had/have) more time, I would travel more.",
            "The report ___ (will be/will have been) ready by Monday.",
            "He's the kind of person ___ (who/whom) always helps others.",
            "I wish I ___ (spoke/would speak) French fluently.",
        ],
    },
    "storytelling": {
        "kids": [
            "Once upon a time there was a little [animal]...",
            "A child finds a magical [object] in the park...",
            "The day I went to space...",
            "My pet dragon and I went on an adventure...",
            "What happened when school was cancelled...",
        ],
        "adults": [
            "The most embarrassing moment I ever had...",
            "A time when I had to make a difficult decision...",
            "My first day at a new job...",
            "A trip that changed the way I see the world...",
            "If I could change one thing about my city...",
        ],
    },
}


def show_platforms():
    print("\n=== ONLINE TEACHING PLATFORMS ===\n")
    if HAS_TABULATE:
        headers = ["Platform", "Rate", "Commission", "Degree?", "TEFL?", "Approval", "Sign Up"]
        rows = [[p["name"], p["rate"], p["commission"], p["degree"], p["tefl"], p["approval"], p["url"]] for p in PLATFORMS]
        print(tabulate(rows, headers=headers, tablefmt="rounded_outline"))
    else:
        for p in PLATFORMS:
            print(f"  {p['name']:12} | {p['rate']:14} | commission: {p['commission']:10} | degree: {p['degree']} | {p['url']}")
    print()


def generate_lesson(age: str, level: str, topic: str, duration: int, dry_run: bool = False) -> str:
    if age not in LESSON_TEMPLATES:
        raise ValueError(f"Invalid age group '{age}'. Use: kids, adults")
    if level not in LESSON_TEMPLATES[age]:
        raise ValueError(f"Invalid level '{level}'. Use: beginner, intermediate, advanced")
    if duration not in (25, 50, 60):
        raise ValueError("Duration must be 25, 50, or 60 minutes")

    template = LESSON_TEMPLATES[age][level]
    scale = duration / 60.0

    lines = [
        f"# Lesson Plan: {topic.title()}",
        f"- Age group: {age}",
        f"- Level: {level}",
        f"- Duration: {duration} min",
        f"- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Lesson Structure",
        "",
        f"### 1. Warm-up ({max(3, int(5 * scale))} min)",
        f"   {template['warm_up']}",
        f"   Topic integration: introduce '{topic}' vocabulary",
        "",
        f"### 2. New Language Introduction ({max(3, int(5 * scale))} min)",
        f"   {template['intro']}",
        f"   Focus: 5–8 '{topic}' vocabulary words",
        "",
        f"### 3. Controlled Practice ({max(5, int(7 * scale))} min)",
        f"   {template['practice']}",
        "",
    ]

    if duration >= 50:
        lines += [
            f"### 4. Break ({max(2, int(3 * scale))} min)",
            f"   {template['break']}",
            "",
        ]

    lines += [
        f"### {'5' if duration >= 50 else '4'}. Free Practice ({max(5, int(10 * scale))} min)",
        f"   {template['free_practice']}",
        "",
        f"### {'6' if duration >= 50 else '5'}. Wrap-up ({max(3, int(5 * scale))} min)",
        f"   {template['wrap_up']}",
        "",
        "## Vocabulary Suggestions",
        f"Research 6–10 words related to '{topic}' appropriate for {age}/{level} level.",
        "",
        "## Materials Needed",
        "- Flashcard images for topic vocabulary",
        "- Whiteboard or virtual whiteboard tool",
        "- Timer for activities",
    ]

    return "\n".join(lines)


def generate_activities(age: str, fmt: str, count: int) -> list:
    if age not in ("kids", "adults"):
        raise ValueError("age must be 'kids' or 'adults'")
    if fmt not in ACTIVITY_TEMPLATES:
        raise ValueError(f"Unknown format '{fmt}'. Options: {', '.join(ACTIVITY_TEMPLATES.keys())}")

    items = ACTIVITY_TEMPLATES[fmt].get(age, [])
    return items[:count] if count <= len(items) else items + [f"[Create more {fmt} activities on topic]"] * (count - len(items))


def main():
    parser = argparse.ArgumentParser(description="teach-eng: English teaching toolkit")
    parser.add_argument("--mode", choices=["platforms", "lesson", "activities"], default="platforms")
    parser.add_argument("--age", choices=["kids", "adults"], default=os.getenv("DEFAULT_AGE", "kids"))
    parser.add_argument("--level", choices=["beginner", "intermediate", "advanced"], default=os.getenv("DEFAULT_LEVEL", "beginner"))
    parser.add_argument("--topic", default="animals")
    parser.add_argument("--duration", type=int, choices=[25, 50, 60], default=int(os.getenv("DEFAULT_DURATION", "60")))
    parser.add_argument("--format", dest="fmt", choices=["qa", "matching", "roleplay", "fillblank", "storytelling"], default="qa")
    parser.add_argument("--count", type=int, default=5)
    parser.add_argument("--dry-run", action="store_true", default=DRY_RUN)
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN MODE ===\n")
        show_platforms()

        plan = generate_lesson("kids", "beginner", "animals", 60, dry_run=True)
        print("=== SAMPLE LESSON PLAN (kids/beginner/animals/60min) ===\n")
        print(plan)

        print("\n=== SAMPLE ACTIVITIES (kids/qa x5) ===\n")
        activities = generate_activities("kids", "qa", 5)
        for i, a in enumerate(activities, 1):
            print(f"  {i}. {a}")

        print("\n[DRY RUN] All modes OK — no files written.")
        return

    if args.mode == "platforms":
        show_platforms()

    elif args.mode == "lesson":
        plan = generate_lesson(args.age, args.level, args.topic, args.duration)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_file = LOGS_DIR / f"lesson_{args.age}_{args.level}_{args.topic}_{ts}.md"
        out_file.write_text(plan)
        print(plan)
        print(f"\n[Saved] {out_file}")

    elif args.mode == "activities":
        activities = generate_activities(args.age, args.fmt, args.count)
        print(f"\n=== {args.fmt.upper()} ACTIVITIES ({args.age}) ===\n")
        for i, a in enumerate(activities, 1):
            print(f"  {i}. {a}")
        print()


if __name__ == "__main__":
    main()
