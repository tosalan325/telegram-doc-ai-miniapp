import asyncio
import base64
import os
import uuid
from pathlib import Path
from typing import Optional

import pymupdf
import requests
from PIL import Image
from docx import Document
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
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

DOWNLOADS_DIR = BASE_DIR / "downloads"
DOWNLOADS_DIR.mkdir(exist_ok=True)

app = FastAPI(title="DocCheck Mini App")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )

# =========================
# Извлечение текста
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

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if text:
            text_parts.append(text)

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
# Изображения
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
- находить важные условия;
- выделять возможные риски;
- подсказывать, какие вопросы стоит задать перед подписанием или перед отправкой документа второй стороне.

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
- подготовить вопросы перед подписанием или перед отправкой документа второй стороне.

Важно:
- ты НЕ являешься юристом;
- ты НЕ даёшь юридическую консультацию;
- если часть текста плохо видна, прямо скажи об этом;
- не выдумывай условия, которых не видно на изображении.

Стиль:
- пиши по-русски;
- понятно и структурировано;
- без лишней воды.
"""

ANALYSIS_PROMPTS = {
    "full": """
Сделай полный анализ документа.

Структура:
1. 📌 Краткое содержание
2. 🧾 Главные условия
3. ✅ Сильные стороны
4. ⚠️ Слабые стороны
5. ❗ Возможные риски
6. 🔍 На что обратить внимание
7. ❓ Что стоит уточнить
8. 🧠 Простое резюме
9. Дисклеймер
""",

    "summary": """
Сделай краткое резюме документа.

Структура:
1. Что это за документ
2. О чём документ
3. 5–7 самых важных условий
4. Итог простыми словами
""",

    "strengths": """
Найди сильные стороны документа.

Структура:
1. Что хорошо прописано
2. Какие условия выглядят понятными
3. Что защищает интересы пользователя
4. Короткий итог
""",

    "weaknesses": """
Найди слабые стороны документа.

Структура:
1. Что прописано неясно
2. Чего может не хватать
3. Какие пункты стоит уточнить
4. Короткий итог
""",

    "risks": """
Найди возможные риски в документе.

Структура:
1. Основные риски
2. Уровень каждого риска: низкий / средний / высокий
3. Почему это может быть проблемой
4. Что уточнить или попросить изменить
""",

    "dates": """
Найди все даты и сроки в документе.

Структура:
1. Найденные даты
2. Найденные сроки
3. Что означает каждая дата или срок
4. На какие сроки обратить особое внимание
""",

    "money": """
Найди все финансовые условия.

Структура:
1. Найденные суммы
2. Порядок оплаты
3. Штрафы, пени, комиссии
4. Возвраты денег, аванса или залога
5. Финансовые риски
""",

    "parties": """
Определи стороны документа.

Структура:
1. Участники документа
2. Данные сторон
3. Обязанности каждой стороны
4. На что обратить внимание
""",

    "attention": """
Выдели пункты, на которые особенно стоит обратить внимание.

Структура:
1. Самые важные пункты
2. Почему это важно
3. Что может быть неприятным сюрпризом
4. Что проверить перед подписанием или отправкой
""",

    "simple": """
Объясни документ максимально простыми словами.

Структура:
1. Если совсем коротко
2. Что от пользователя хотят
3. Что пользователь получает
4. Где нужно быть осторожным
""",

    "fixes": """
Предложи, что можно улучшить или исправить в документе.

Структура:
1. Что желательно добавить
2. Что желательно уточнить
3. Какие формулировки стоит сделать точнее
4. Что обсудить со второй стороной
""",

    "questions": """
Составь список вопросов второй стороне.

Структура:
1. Вопросы по деньгам
2. Вопросы по срокам
3. Вопросы по обязанностям
4. Вопросы по ответственности и штрафам
5. Вопросы по расторжению и возвратам
6. Дополнительные важные вопросы
""",

    "dangerous": """
Найди потенциально опасные, спорные или размытые формулировки.

Структура:
1. Найденные формулировки
2. Почему они могут быть рискованными
3. Как можно уточнить
""",

    "score": """
Оцени документ по понятности и рискам.

Структура:
1. Общая оценка от 1 до 10
2. Понятность: от 1 до 10
3. Полнота условий: от 1 до 10
4. Финансовая прозрачность: от 1 до 10
5. Сроки: от 1 до 10
6. Риски для пользователя: низкие / средние / высокие
7. Что улучшить в первую очередь
""",

    "custom": """
Ответь на конкретный вопрос пользователя по документу.
Используй только информацию из документа.
Если ответа нет в документе — прямо скажи, что в тексте документа это не найдено.
""",
}


def get_role_instruction(user_role: str) -> str:
    if user_role == "author":
        return """
Контекст пользователя:
Пользователь сам составляет или редактирует этот документ.

Фокус анализа:
- что стоит добавить;
- что стоит уточнить;
- какие формулировки сделать точнее;
- как сделать документ понятнее;
- какие вопросы могут возникнуть у второй стороны.
"""

    return """
Контекст пользователя:
Пользователь проверяет документ перед подписанием.

Фокус анализа:
- какие условия могут быть невыгодными;
- какие риски есть для пользователя;
- что важно уточнить перед подписью;
- какие пункты могут повлиять на деньги, сроки и ответственность.
"""


def get_analysis_instruction(analysis_type: str) -> str:
    return ANALYSIS_PROMPTS.get(analysis_type, ANALYSIS_PROMPTS["full"]).strip()


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
        raise Exception(f"OpenRouter API error {response.status_code}: {response.text}")

    data = response.json()

    try:
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        raise Exception(f"Неожиданный ответ от OpenRouter: {data}")

# =========================
# Анализ одного документа
# =========================

def analyze_document_text_with_ai(
    document_text: str,
    analysis_type: str = "full",
    user_role: str = "signer",
    custom_question: str = "",
) -> str:
    document_text = limit_text(document_text)
    role_instruction = get_role_instruction(user_role)
    analysis_instruction = get_analysis_instruction(analysis_type)

    if analysis_type == "custom":
        user_prompt = f"""
{role_instruction}

Пользователь задал вопрос:
{custom_question}

Ответь на вопрос по документу.
Если в документе нет информации для ответа — так и скажи.

Текст документа:

{document_text}
"""
    else:
        user_prompt = f"""
{role_instruction}

Задача анализа:
{analysis_instruction}

Текст документа:

{document_text}
"""

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT_TEXT.strip()},
            {"role": "user", "content": user_prompt.strip()},
        ],
        "temperature": 0.2,
        "max_tokens": 3500,
    }

    return call_openrouter(payload)


def analyze_document_images_with_ai(
    image_paths: list[Path],
    analysis_type: str = "full",
    user_role: str = "signer",
    custom_question: str = "",
) -> str:
    role_instruction = get_role_instruction(user_role)
    analysis_instruction = get_analysis_instruction(analysis_type)

    if analysis_type == "custom":
        task_text = f"""
{role_instruction}

Пользователь задал вопрос:
{custom_question}

Ответь на вопрос по документу на изображении.
Если в документе нет информации для ответа — прямо скажи об этом.
"""
    else:
        task_text = f"""
{role_instruction}

Задача анализа:
{analysis_instruction}
"""

    content = [
        {
            "type": "text",
            "text": f"""
На изображении или изображениях находится документ.

Сначала внимательно прочитай видимый текст.
Если страниц несколько, учитывай их как один документ.
Если часть текста плохо видна — прямо скажи об этом.
Не выдумывай условия, которых не видно.

{task_text}
""".strip(),
        }
    ]

    for image_path in image_paths:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": image_to_data_url(image_path)},
            }
        )

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT_IMAGE.strip()},
            {"role": "user", "content": content},
        ],
        "temperature": 0.2,
        "max_tokens": 3500,
    }

    return call_openrouter(payload, timeout=240)

# =========================
# Подготовка файлов
# =========================

ALLOWED_EXTENSIONS = [
    ".pdf",
    ".docx",
    ".txt",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
]

IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]


async def save_upload_file(file: UploadFile) -> tuple[Path, str]:
    original_name = Path(file.filename or "document").name
    file_extension = Path(original_name).suffix.lower()

    if file_extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Неподдерживаемый формат файла. Можно загрузить PDF, DOCX, TXT, JPG, PNG или WEBP.")

    safe_name = original_name.replace(" ", "_").replace("/", "_").replace("\\", "_")
    local_file_path = DOWNLOADS_DIR / f"{uuid.uuid4().hex}_{safe_name}"

    file_bytes = await file.read()

    with open(local_file_path, "wb") as f:
        f.write(file_bytes)

    return local_file_path, file_extension


def extract_document_content(local_file_path: Path, file_extension: str) -> dict:
    if file_extension in IMAGE_EXTENSIONS:
        return {
            "kind": "images",
            "images": [local_file_path],
        }

    if file_extension == ".txt":
        extracted_text = extract_text_from_txt(local_file_path)

        if not extracted_text:
            raise ValueError("TXT-файл пустой или текст не удалось прочитать.")

        return {
            "kind": "text",
            "text": extracted_text,
        }

    if file_extension == ".docx":
        extracted_text = extract_text_from_docx(local_file_path)

        if not extracted_text:
            raise ValueError(
                "DOCX получен, но внутри не найден редактируемый текст. Возможно, документ содержит скан или картинку."
            )

        return {
            "kind": "text",
            "text": extracted_text,
        }

    if file_extension == ".pdf":
        extracted_text = extract_text_from_pdf(local_file_path)

        if extracted_text:
            return {
                "kind": "text",
                "text": extracted_text,
            }

        image_paths = convert_pdf_pages_to_images(local_file_path, max_pages=3)

        if not image_paths:
            raise ValueError("PDF не содержит текста, и его не удалось преобразовать в изображения.")

        return {
            "kind": "images",
            "images": image_paths,
        }

    raise ValueError("Файл не удалось обработать.")

# =========================
# Сравнение документов
# =========================

def compare_documents_with_ai(
    first_content: dict,
    second_content: dict,
    user_role: str = "signer",
) -> str:
    role_instruction = get_role_instruction(user_role)

    compare_instruction = f"""
{role_instruction}

Сравни два документа.

Структура ответа:
1. 📌 Краткий вывод
Коротко объясни, похожи документы или отличаются существенно.

2. 🔄 Главные отличия
Перечисли самые важные отличия.

3. 💰 Отличия по деньгам
Если есть суммы, платежи, штрафы, комиссии — сравни их.

4. 📅 Отличия по срокам
Сравни даты, сроки, дедлайны, периоды действия.

5. ⚠️ Что стало рискованнее
Покажи условия, которые во втором документе могут быть хуже или опаснее.

6. ✅ Что стало лучше
Покажи условия, которые стали понятнее или выгоднее.

7. ❓ Что уточнить перед подписанием
Список вопросов второй стороне.

8. 🧠 Простое резюме
Коротко объясни обычным языком, на что обратить внимание.

Важно:
- если документы плохо читаются, скажи об этом;
- не выдумывай отличия;
- если сравнение неполное из-за качества файла, предупреди пользователя.
"""

    # Если оба документа текстовые — отправляем как обычный текст
    if first_content["kind"] == "text" and second_content["kind"] == "text":
        user_prompt = f"""
{compare_instruction}

Документ 1:

{limit_text(first_content["text"], 18000)}

Документ 2:

{limit_text(second_content["text"], 18000)}
"""

        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT_TEXT.strip()},
                {"role": "user", "content": user_prompt.strip()},
            ],
            "temperature": 0.2,
            "max_tokens": 4000,
        }

        return call_openrouter(payload, timeout=240)

    # Если хотя бы один документ — изображение/скан
    content = [
        {
            "type": "text",
            "text": compare_instruction.strip(),
        }
    ]

    if first_content["kind"] == "text":
        content.append(
            {
                "type": "text",
                "text": f"Документ 1, текст:\n\n{limit_text(first_content['text'], 14000)}",
            }
        )
    else:
        content.append({"type": "text", "text": "Документ 1, изображения:"})
        for image_path in first_content["images"]:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": image_to_data_url(image_path)},
                }
            )

    if second_content["kind"] == "text":
        content.append(
            {
                "type": "text",
                "text": f"Документ 2, текст:\n\n{limit_text(second_content['text'], 14000)}",
            }
        )
    else:
        content.append({"type": "text", "text": "Документ 2, изображения:"})
        for image_path in second_content["images"]:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": image_to_data_url(image_path)},
                }
            )

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT_IMAGE.strip()},
            {"role": "user", "content": content},
        ],
        "temperature": 0.2,
        "max_tokens": 4000,
    }

    return call_openrouter(payload, timeout=240)

# =========================
# API
# =========================

@app.post("/api/analyze")
async def analyze_file(
    file: UploadFile = File(...),
    file2: Optional[UploadFile] = File(None),
    analysis_type: str = Form("full"),
    user_role: str = Form("signer"),
    custom_question: str = Form(""),
):
    try:
        if user_role not in ["signer", "author"]:
            user_role = "signer"

        if analysis_type not in ANALYSIS_PROMPTS and analysis_type != "compare":
            analysis_type = "full"

        if analysis_type == "custom" and not custom_question.strip():
            return JSONResponse(
                status_code=400,
                content={
                    "ok": False,
                    "error": "Введите свой вопрос по документу.",
                },
            )

        first_file_path, first_extension = await save_upload_file(file)
        first_content = extract_document_content(first_file_path, first_extension)

        # Сравнение двух документов
        if analysis_type == "compare":
            if file2 is None:
                return JSONResponse(
                    status_code=400,
                    content={
                        "ok": False,
                        "error": "Для сравнения нужно загрузить второй документ.",
                    },
                )

            second_file_path, second_extension = await save_upload_file(file2)
            second_content = extract_document_content(second_file_path, second_extension)

            result = await asyncio.to_thread(
                compare_documents_with_ai,
                first_content,
                second_content,
                user_role,
            )

            return {
                "ok": True,
                "analysis_type": analysis_type,
                "result": result,
            }

        # Обычный анализ одного документа
        if first_content["kind"] == "text":
            result = await asyncio.to_thread(
                analyze_document_text_with_ai,
                first_content["text"],
                analysis_type,
                user_role,
                custom_question.strip(),
            )

            return {
                "ok": True,
                "analysis_type": analysis_type,
                "result": result,
            }

        if first_content["kind"] == "images":
            result = await asyncio.to_thread(
                analyze_document_images_with_ai,
                first_content["images"],
                analysis_type,
                user_role,
                custom_question.strip(),
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