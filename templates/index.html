import asyncio
import base64
import os
from pathlib import Path

import pymupdf
import requests
from PIL import Image
from docx import Document
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request
from pypdf import PdfReader

# =========================
# Настройки проекта
# =========================

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
WEBAPP_URL = os.getenv("WEBAPP_URL", "http://127.0.0.1:8000")

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY не найден. Проверь файл .env")

# =========================
# Папки
# =========================

DOWNLOADS_DIR = BASE_DIR / "downloads"
DOWNLOADS_DIR.mkdir(exist_ok=True)

# =========================
# FastAPI
# =========================

app = FastAPI(title="DocCheck Mini App")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# =========================
# Главная страница Mini App
# =========================

@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )

# =========================
# Извлечение текста из документов
# =========================

def extract_text_from_pdf(file_path: Path) -> str:
    text_parts = []

    reader = PdfReader(str(file_path))

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text_parts.append(page_text)

    return "\n".join(text_parts).strip()


def extract_text_from_docx(file_path: Path) -> str:
    document = Document(str(file_path))

    text_parts = []

    # Обычные абзацы
    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if text:
            text_parts.append(text)

    # Текст внутри таблиц
    for table in document.tables:
        for row in table.rows:
            row_text_parts = []

            for cell in row.cells:
                cell_text = cell.text.strip()
                if cell_text:
                    row_text_parts.append(cell_text)

            if row_text_parts:
                text_parts.append(" | ".join(row_text_parts))

    return "\n".join(text_parts).strip()


def extract_text_from_txt(file_path: Path) -> str:
    return file_path.read_text(encoding="utf-8", errors="ignore").strip()


def limit_text(text: str, max_chars: int = 25000) -> str:
    if len(text) <= max_chars:
        return text

    return text[:max_chars] + "\n\n[Документ был обрезан из-за ограничения размера.]"

# =========================
# Работа с изображениями
# =========================

def prepare_image_for_ai(input_path: Path) -> Path:
    output_path = input_path.with_suffix(".prepared.jpg")

    image = Image.open(input_path)
    image = image.convert("RGB")

    max_side = 1600
    width, height = image.size

    if max(width, height) > max_side:
        if width >= height:
            new_width = max_side
            new_height = int(height * max_side / width)
        else:
            new_height = max_side
            new_width = int(width * max_side / height)

        image = image.resize((new_width, new_height))

    image.save(output_path, format="JPEG", quality=85)

    return output_path


def image_to_data_url(image_path: Path) -> str:
    prepared_path = prepare_image_for_ai(image_path)

    with open(prepared_path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")

    return f"data:image/jpeg;base64,{encoded}"


def convert_pdf_pages_to_images(pdf_path: Path, max_pages: int = 3) -> list[Path]:
    image_paths = []

    pdf_document = pymupdf.open(str(pdf_path))
    pages_count = min(len(pdf_document), max_pages)

    for page_index in range(pages_count):
        page = pdf_document[page_index]
        pix = page.get_pixmap(dpi=180)

        image_path = DOWNLOADS_DIR / f"{pdf_path.stem}_page_{page_index + 1}.jpg"
        pix.save(str(image_path))

        image_paths.append(image_path)

    pdf_document.close()

    return image_paths

# =========================
# OpenRouter
# =========================

SYSTEM_PROMPT_TEXT = """
Ты — AI-помощник для понятного разбора документов.

Твоя задача:
- объяснять документы простым человеческим языком;
- находить потенциально важные условия;
- выделять возможные риски;
- подсказывать, какие вопросы стоит задать перед подписанием.

Важно:
- ты НЕ являешься юристом;
- ты НЕ даёшь юридическую консультацию;
- ты НЕ говоришь "подписывать можно" или "подписывать нельзя";
- ты НЕ утверждаешь, что документ законный или незаконный;
- ты помогаешь пользователю понять документ и подготовить вопросы.

Стиль:
- пиши по-русски;
- понятно и структурировано;
- без лишней воды;
- если данных недостаточно, прямо скажи об этом;
- используй осторожные формулировки: "стоит уточнить", "может быть риском", "обратите внимание".
"""

SYSTEM_PROMPT_IMAGE = """
Ты — AI-помощник для понятного разбора документов по изображению.

Твоя задача:
- внимательно прочитать текст на изображении;
- определить, что это за документ;
- объяснить его простым языком;
- найти важные условия;
- выделить возможные риски;
- подготовить вопросы перед подписанием.

Важно:
- ты НЕ являешься юристом;
- ты НЕ даёшь юридическую консультацию;
- ты НЕ говоришь "подписывать можно" или "подписывать нельзя";
- ты НЕ утверждаешь, что документ законный или незаконный;
- если часть текста плохо видна, прямо скажи об этом;
- не выдумывай условия, которых не видно на изображении;
- если изображений несколько, воспринимай их как страницы одного документа.

Стиль:
- пиши по-русски;
- понятно и структурировано;
- без лишней воды;
- используй осторожные формулировки: "стоит уточнить", "может быть риском", "обратите внимание".
"""

# =========================
# Типы анализа
# =========================

ANALYSIS_PROMPTS = {
    "full": {
        "title": "Полный анализ документа",
        "instruction": """
Сделай полный анализ документа строго в такой структуре:

1. Краткое содержание
Коротко объясни, что это за документ и о чём он.

2. Главные условия
Выдели самые важные условия:
- деньги;
- сроки;
- обязанности сторон;
- штрафы;
- расторжение;
- возврат денег, залога или аванса;
- ответственность.

3. Возможные риски
Список потенциально рискованных или спорных пунктов.
Если явных рисков нет, так и скажи, но добавь, что это не гарантия безопасности.

4. Что стоит уточнить перед подписью
Список конкретных вопросов, которые пользователь может задать второй стороне.

5. Простое резюме
Короткий итог человеческим языком.

6. Дисклеймер
Напомни, что это не юридическая консультация и при важных сделках лучше обратиться к специалисту.
"""
    },

    "summary": {
        "title": "Краткое резюме",
        "instruction": """
Сделай краткое резюме документа.

Структура ответа:

1. Что это за документ
Объясни простыми словами.

2. О чём документ
Кратко опиши суть.

3. Самые важные условия
Выдели 5–7 главных пунктов.

4. Итог простыми словами
Напиши короткий понятный вывод для обычного человека.
"""
    },

    "strengths": {
        "title": "Сильные стороны документа",
        "instruction": """
Найди сильные стороны документа.

Структура ответа:

1. Что хорошо прописано
Список сильных сторон.

2. Какие условия выглядят понятными
Отметь условия, которые сформулированы достаточно ясно.

3. Что защищает интересы пользователя
Если такие пункты есть, перечисли их.

4. Короткий итог
Сделай вывод, какие части документа выглядят наиболее проработанными.
"""
    },

    "weaknesses": {
        "title": "Слабые стороны документа",
        "instruction": """
Найди слабые стороны документа.

Структура ответа:

1. Что прописано неясно
Список неясных или размытых формулировок.

2. Чего может не хватать
Например: сроков, ответственности, порядка оплаты, возврата денег, расторжения, штрафов.

3. Какие пункты стоит уточнить
Конкретные пункты или темы.

4. Короткий итог
Объясни, какие слабые места могут быть важны для пользователя.
"""
    },

    "risks": {
        "title": "Риски документа",
        "instruction": """
Найди возможные риски в документе.

Структура ответа:

1. Основные риски
Список потенциально рискованных условий.

2. Уровень риска
Для каждого риска укажи уровень:
- низкий;
- средний;
- высокий.

3. Почему это может быть проблемой
Объясни простыми словами.

4. Что уточнить или попросить изменить
Дай практические вопросы или рекомендации для обсуждения.

Важно: не утверждай, что документ незаконный. Используй осторожные формулировки.
"""
    },

    "dates": {
        "title": "Даты и сроки",
        "instruction": """
Найди все даты и сроки в документе.

Структура ответа:

1. Найденные даты
Перечисли все конкретные даты.

2. Найденные сроки
Перечисли сроки: дни, месяцы, рабочие дни, периоды, дедлайны.

3. Что означает каждая дата или срок
Объясни назначение каждой даты.

4. На какие сроки обратить внимание
Выдели критичные сроки: оплата, выполнение работ, расторжение, претензии, возврат денег, штрафы.

Если дат или сроков нет, прямо скажи об этом.
"""
    },

    "money": {
        "title": "Деньги и суммы",
        "instruction": """
Найди все финансовые условия в документе.

Структура ответа:

1. Найденные суммы
Перечисли все суммы, цены, платежи, авансы, залоги, комиссии.

2. Порядок оплаты
Когда и как должна происходить оплата.

3. Штрафы, пени, неустойки
Если есть — перечисли.

4. Возвраты денег, аванса или залога
Если есть условия возврата — объясни.

5. Финансовые риски
На что стоит обратить внимание.

Если сумм нет, прямо скажи об этом.
"""
    },

    "parties": {
        "title": "Стороны документа",
        "instruction": """
Определи стороны документа.

Структура ответа:

1. Участники документа
Кто является сторонами: заказчик, исполнитель, продавец, покупатель, арендодатель, арендатор и т.д.

2. Данные сторон
Если указаны: ФИО, название компании, ИНН, адрес, должность, представитель.

3. Обязанности каждой стороны
Кратко перечисли, что должна сделать каждая сторона.

4. На что обратить внимание
Отметь, если данных сторон не хватает или они указаны неполно.
"""
    },

    "attention": {
        "title": "На что обратить внимание",
        "instruction": """
Выдели пункты, на которые пользователю особенно стоит обратить внимание.

Структура ответа:

1. Самые важные пункты
Список ключевых условий.

2. Почему это важно
Кратко объясни каждый пункт.

3. Что может быть неприятным сюрпризом
Отметь условия, которые пользователь может пропустить.

4. Что проверить перед подписанием
Практический чек-лист.
"""
    },

    "simple": {
        "title": "Простыми словами",
        "instruction": """
Объясни документ максимально простыми словами.

Структура ответа:

1. Если совсем коротко
2–4 предложения о сути документа.

2. Что от пользователя хотят
Объясни обязательства пользователя.

3. Что пользователь получает
Объясни выгоду или результат.

4. Где нужно быть осторожным
Простыми словами перечисли важные моменты.

Пиши без сложных юридических формулировок.
"""
    },

    "fixes": {
        "title": "Что исправить в документе",
        "instruction": """
Предложи, что можно улучшить или исправить в документе.

Структура ответа:

1. Что желательно добавить
Список недостающих условий.

2. Что желательно уточнить
Размытые или неполные пункты.

3. Какие формулировки стоит сделать точнее
Если возможно, приведи примеры.

4. Что обсудить со второй стороной
Практический список вопросов.

Важно: не переписывай весь договор полностью, только укажи направления для улучшения.
"""
    },

    "questions": {
        "title": "Вопросы второй стороне",
        "instruction": """
Составь список вопросов, которые пользователь может задать второй стороне перед подписанием.

Структура ответа:

1. Вопросы по деньгам
2. Вопросы по срокам
3. Вопросы по обязанностям
4. Вопросы по ответственности и штрафам
5. Вопросы по расторжению и возвратам
6. Дополнительные важные вопросы

Формулируй вопросы простым языком.
"""
    },

    "dangerous": {
        "title": "Опасные формулировки",
        "instruction": """
Найди потенциально опасные, спорные или слишком размытые формулировки.

Структура ответа:

1. Найденные формулировки
Приведи цитаты или близкий пересказ.

2. Почему они могут быть рискованными
Объясни простыми словами.

3. Как можно уточнить
Предложи, что стоит спросить или попросить конкретизировать.

Если опасных формулировок не найдено, прямо скажи об этом.
"""
    },

    "score": {
        "title": "Оценка документа",
        "instruction": """
Оцени документ по понятности и рискам.

Структура ответа:

1. Общая оценка
Поставь оценку от 1 до 10 и объясни почему.

2. Оценка по критериям
- Понятность: от 1 до 10
- Полнота условий: от 1 до 10
- Финансовая прозрачность: от 1 до 10
- Сроки: от 1 до 10
- Риски для пользователя: низкие / средние / высокие

3. Главные плюсы
4. Главные минусы
5. Что улучшить в первую очередь

Важно: оценка ориентировочная, это не юридическое заключение.
"""
    },
}


def get_analysis_instruction(analysis_type: str) -> str:
    analysis = ANALYSIS_PROMPTS.get(analysis_type)

    if not analysis:
        analysis = ANALYSIS_PROMPTS["full"]

    return analysis["instruction"].strip()


def call_openrouter(payload: dict, timeout: int = 240) -> str:
    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": WEBAPP_URL,
        "X-Title": "DocCheck Mini App",
    }

    response = requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=timeout,
    )

    if response.status_code != 200:
        raise Exception(
            f"OpenRouter API error {response.status_code}: {response.text}"
        )

    data = response.json()

    try:
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        raise Exception(f"Неожиданный ответ от OpenRouter: {data}")


def analyze_document_text_with_ai(document_text: str, analysis_type: str = "full") -> str:
    document_text = limit_text(document_text)
    analysis_instruction = get_analysis_instruction(analysis_type)

    user_prompt = f"""
Проанализируй документ ниже.

Задача анализа:
{analysis_instruction}

Текст документа:

{document_text}
"""

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT_TEXT.strip(),
            },
            {
                "role": "user",
                "content": user_prompt.strip(),
            },
        ],
        "temperature": 0.2,
        "max_tokens": 3000,
    }

    return call_openrouter(payload)


def analyze_document_images_with_ai(image_paths: list[Path], analysis_type: str = "full") -> str:
    analysis_instruction = get_analysis_instruction(analysis_type)

    content = [
        {
            "type": "text",
            "text": f"""
На изображении или изображениях находится документ.

Сначала внимательно прочитай видимый текст.
Если страниц несколько, учитывай их как один документ.

Если часть текста плохо видна или неразборчива — прямо скажи об этом.
Не выдумывай условия, которых не видно на изображении.

Задача анализа:
{analysis_instruction}
""".strip(),
        }
    ]

    for image_path in image_paths:
        image_data_url = image_to_data_url(image_path)

        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": image_data_url,
                },
            }
        )

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT_IMAGE.strip(),
            },
            {
                "role": "user",
                "content": content,
            },
        ],
        "temperature": 0.2,
        "max_tokens": 3000,
    }

    return call_openrouter(payload, timeout=240)

# =========================
# API загрузки файла
# =========================

@app.post("/api/analyze")
async def analyze_file(
    file: UploadFile = File(...),
    analysis_type: str = Form("full"),
):
    try:
        original_name = file.filename or "document"
        file_extension = Path(original_name).suffix.lower()

        allowed_extensions = [
            ".pdf",
            ".docx",
            ".txt",
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
        ]

        if file_extension not in allowed_extensions:
            return JSONResponse(
                status_code=400,
                content={
                    "ok": False,
                    "error": "Неподдерживаемый формат файла. Можно загрузить PDF, DOCX, TXT, JPG, PNG или WEBP.",
                },
            )

        if analysis_type not in ANALYSIS_PROMPTS:
            analysis_type = "full"

        safe_name = original_name.replace(" ", "_")
        local_file_path = DOWNLOADS_DIR / safe_name

        file_bytes = await file.read()

        with open(local_file_path, "wb") as f:
            f.write(file_bytes)

        image_extensions = [".jpg", ".jpeg", ".png", ".webp"]

        # Картинка
        if file_extension in image_extensions:
            result = await asyncio.to_thread(
                analyze_document_images_with_ai,
                [local_file_path],
                analysis_type,
            )

            return {
                "ok": True,
                "analysis_type": analysis_type,
                "result": result,
            }

        # TXT
        if file_extension == ".txt":
            extracted_text = extract_text_from_txt(local_file_path)

            if not extracted_text:
                return JSONResponse(
                    status_code=400,
                    content={
                        "ok": False,
                        "error": "TXT-файл пустой или текст не удалось прочитать.",
                    },
                )

            result = await asyncio.to_thread(
                analyze_document_text_with_ai,
                extracted_text,
                analysis_type,
            )

            return {
                "ok": True,
                "analysis_type": analysis_type,
                "result": result,
            }

        # DOCX
        if file_extension == ".docx":
            extracted_text = extract_text_from_docx(local_file_path)

            if not extracted_text:
                return JSONResponse(
                    status_code=400,
                    content={
                        "ok": False,
                        "error": "DOCX получен, но внутри не найден редактируемый текст. Возможно, документ содержит скан или картинку. Пока загрузите этот документ как PDF, TXT, JPG или PNG.",
                    },
                )

            result = await asyncio.to_thread(
                analyze_document_text_with_ai,
                extracted_text,
                analysis_type,
            )

            return {
                "ok": True,
                "analysis_type": analysis_type,
                "result": result,
            }

        # PDF
        if file_extension == ".pdf":
            extracted_text = extract_text_from_pdf(local_file_path)

            if extracted_text:
                result = await asyncio.to_thread(
                    analyze_document_text_with_ai,
                    extracted_text,
                    analysis_type,
                )

                return {
                    "ok": True,
                    "analysis_type": analysis_type,
                    "result": result,
                }

            # Если PDF сканированный
            image_paths = convert_pdf_pages_to_images(local_file_path, max_pages=3)

            if not image_paths:
                return JSONResponse(
                    status_code=400,
                    content={
                        "ok": False,
                        "error": "PDF не содержит текста, и его не удалось преобразовать в изображения.",
                    },
                )

            result = await asyncio.to_thread(
                analyze_document_images_with_ai,
                image_paths,
                analysis_type,
            )

            return {
                "ok": True,
                "analysis_type": analysis_type,
                "result": result,
            }

        return JSONResponse(
            status_code=400,
            content={
                "ok": False,
                "error": "Файл не удалось обработать.",
            },
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": str(e),
            },
        )