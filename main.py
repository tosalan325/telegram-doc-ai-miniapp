import asyncio
import base64
import os
from pathlib import Path

import pymupdf
import requests
from PIL import Image
from docx import Document
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
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


def analyze_document_text_with_ai(document_text: str) -> str:
    document_text = limit_text(document_text)

    user_prompt = f"""
Проанализируй документ ниже.

Сделай ответ строго в такой структуре:

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


def analyze_document_images_with_ai(image_paths: list[Path]) -> str:
    content = [
        {
            "type": "text",
            "text": """
На изображении или изображениях находится документ.

Сначала внимательно прочитай видимый текст.
Если страниц несколько, учитывай их как один документ.

Сделай ответ строго в такой структуре:

1. Что удалось прочитать
Кратко опиши, насколько хорошо виден текст.
Если часть текста неразборчива, скажи об этом.

2. Краткое содержание
Объясни, что это за документ и о чём он.

3. Главные условия
Выдели самые важные условия:
- деньги;
- сроки;
- обязанности сторон;
- штрафы;
- расторжение;
- возврат денег, залога или аванса;
- ответственность.

4. Возможные риски
Список потенциально рискованных или спорных пунктов.
Не выдумывай риски, если их не видно в тексте.

5. Что стоит уточнить перед подписью
Список конкретных вопросов, которые пользователь может задать второй стороне.

6. Простое резюме
Короткий итог человеческим языком.

7. Дисклеймер
Напомни, что это не юридическая консультация и при важных сделках лучше обратиться к специалисту.
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
async def analyze_file(file: UploadFile = File(...)):
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
            )

            return {
                "ok": True,
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
            )

            return {
                "ok": True,
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
            )

            return {
                "ok": True,
                "result": result,
            }

        # PDF
        if file_extension == ".pdf":
            extracted_text = extract_text_from_pdf(local_file_path)

            if extracted_text:
                result = await asyncio.to_thread(
                    analyze_document_text_with_ai,
                    extracted_text,
                )

                return {
                    "ok": True,
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
            )

            return {
                "ok": True,
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