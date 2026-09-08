#!/usr/bin/env python3
"""
MYRAA AI OS — AWS Bedrock Runtime Bridge
Supports text chat, streaming, vision (jpg/png/webp/gif), documents (pdf/txt/docx/md), and model health checks.
"""
import sys
import os
import json
import base64
import traceback

def get_bedrock_client(region="ap-southeast-2", token=None):
    import boto3
    bearer_token = token or os.environ.get("AWS_BEARER_TOKEN_BEDROCK") or os.environ.get("AWS_BEARER_TOKEN")
    if bearer_token:
        os.environ["AWS_BEARER_TOKEN_BEDROCK"] = bearer_token
        os.environ["AWS_BEARER_TOKEN"] = bearer_token
    
    os.environ["AWS_DEFAULT_REGION"] = region
    return boto3.client("bedrock-runtime", region_name=region)

def health_check(region="ap-southeast-2", token=None):
    client = get_bedrock_client(region, token)
    test_models = [
        "amazon.nova-pro-v1:0",
        "amazon.nova-lite-v1:0",
        "amazon.nova-micro-v1:0",
        "apac.amazon.nova-pro-v1:0",
        "apac.amazon.nova-lite-v1:0"
    ]
    available_models = []
    for m in test_models:
        try:
            res = client.converse(
                modelId=m,
                messages=[{"role": "user", "content": [{"text": "ping"}]}],
                inferenceConfig={"maxTokens": 5}
            )
            available_models.append({
                "id": m,
                "status": "online",
                "capabilities": ["text", "multimodal", "code", "reasoning"] if "pro" in m or "lite" in m else ["text"]
            })
        except Exception as e:
            available_models.append({
                "id": m,
                "status": "offline",
                "error": str(e)[:100]
            })
    
    online_count = sum(1 for x in available_models if x["status"] == "online")
    return {
        "ok": online_count > 0,
        "provider": "aws_bedrock",
        "region": region,
        "models": available_models
    }

def converse(data):
    region = data.get("region", "ap-southeast-2")
    token = data.get("token")
    model_id = data.get("model_id", "amazon.nova-pro-v1:0")
    messages = data.get("messages", [])
    system_prompt = data.get("system_prompt")
    max_tokens = int(data.get("max_tokens", 2048))
    temperature = float(data.get("temperature", 0.7))

    client = get_bedrock_client(region, token)

    formatted_messages = []
    for msg in messages:
        role = msg.get("role", "user")
        content_items = []
        raw_content = msg.get("content")

        if isinstance(raw_content, str):
            content_items.append({"text": raw_content})
        elif isinstance(raw_content, list):
            for item in raw_content:
                if isinstance(item, str):
                    content_items.append({"text": item})
                elif isinstance(item, dict):
                    if "text" in item:
                        content_items.append({"text": item["text"]})
                    elif "image" in item:
                        img_info = item["image"]
                        fmt = img_info.get("format", "png")
                        if "base64" in img_info:
                            raw_bytes = base64.b64decode(img_info["base64"])
                        elif "path" in img_info and os.path.exists(img_info["path"]):
                            with open(img_info["path"], "rb") as f:
                                raw_bytes = f.read()
                        elif "bytes" in img_info:
                            raw_bytes = img_info["bytes"]
                        else:
                            continue
                        content_items.append({
                            "image": {
                                "format": fmt,
                                "source": {"bytes": raw_bytes}
                            }
                        })
                    elif "document" in item:
                        doc_info = item["document"]
                        doc_fmt = doc_info.get("format", "txt")
                        doc_name = doc_info.get("name", "document")
                        if "base64" in doc_info:
                            raw_bytes = base64.b64decode(doc_info["base64"])
                        elif "path" in doc_info and os.path.exists(doc_info["path"]):
                            with open(doc_info["path"], "rb") as f:
                                raw_bytes = f.read()
                        elif "text" in doc_info:
                            raw_bytes = doc_info["text"].encode("utf-8")
                        else:
                            continue
                        content_items.append({
                            "document": {
                                "format": doc_fmt,
                                "name": doc_name,
                                "source": {"bytes": raw_bytes}
                            }
                        })
        
        formatted_messages.append({"role": role, "content": content_items})

    kwargs = {
        "modelId": model_id,
        "messages": formatted_messages,
        "inferenceConfig": {
            "maxTokens": max_tokens,
            "temperature": temperature
        }
    }
    if system_prompt:
        kwargs["system"] = [{"text": system_prompt}]

    response = client.converse(**kwargs)
    output_message = response.get("output", {}).get("message", {})
    text_content = ""
    for piece in output_message.get("content", []):
        if "text" in piece:
            text_content += piece["text"]

    usage = response.get("usage", {})
    metrics = response.get("metrics", {})

    return {
        "ok": True,
        "model_id": model_id,
        "text": text_content,
        "role": output_message.get("role", "assistant"),
        "usage": usage,
        "latency_ms": metrics.get("latencyMs", 0)
    }

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({"ok": False, "error": "No JSON payload received"}))
            return
        payload = json.loads(input_data)
        action = payload.get("action", "converse")

        if action == "health":
            res = health_check(payload.get("region", "ap-southeast-2"), payload.get("token"))
        elif action == "converse":
            res = converse(payload)
        else:
            res = {"ok": False, "error": f"Unknown action: {action}"}

        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))

if __name__ == "__main__":
    main()
