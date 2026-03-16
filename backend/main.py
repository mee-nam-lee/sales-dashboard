from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse
from bigquery_client import bq_client
import pandas as pd
from google.cloud import geminidataanalytics
from google.protobuf.json_format import MessageToDict
import json
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_AGENT_ID = os.getenv("DATA_AGENT_ID")
BILLING_PROJECT = os.getenv("BILLING_PROJECT")
LOCATION = os.getenv("LOCATION")
DASHBOARD_TABS_RAW = os.getenv("DASHBOARD_TABS", "[]")
DASHBOARD_BASELINES_RAW = os.getenv("DASHBOARD_BASELINES", "{}")

@app.get("/api/config")
async def get_config():
    try:
        # Resolve the JSON strings from env
        def parse_env_json(raw_str, default):
            s = raw_str.strip()
            if s.startswith("'") and s.endswith("'"):
                s = s[1:-1]
            return json.loads(s) if s else default

        tabs = parse_env_json(DASHBOARD_TABS_RAW, [])
        baselines = parse_env_json(DASHBOARD_BASELINES_RAW, {})
        
        return {
            "tabs": tabs,
            "baselines": baselines
        }
    except Exception as e:
        print(f"DEBUG: Config Error: {e}", flush=True)
        return {"tabs": [], "baselines": {}}

@app.post("/api/chat/conversation/create")
async def create_conversation(conversation_id: str = Query("lg-sales-revenue")):
    try:
        client = geminidataanalytics.DataChatServiceAsyncClient()
        
        # 1. Try to get existing conversation first
        conversation_name = f"projects/{BILLING_PROJECT}/locations/{LOCATION}/conversations/{conversation_id}"
        try:
            response = await client.get_conversation(name=conversation_name)
            return {"conversation_name": response.name}
        except Exception:
            # If not found or error, proceed to create
            pass

        # 2. Create if not exists
        conversation = geminidataanalytics.Conversation()
        conversation.agents = [f'projects/{BILLING_PROJECT}/locations/{LOCATION}/dataAgents/{DATA_AGENT_ID}']
        
        parent = f"projects/{BILLING_PROJECT}/locations/{LOCATION}"
        request = geminidataanalytics.CreateConversationRequest(
            parent=parent,
            conversation=conversation,
            conversation_id=conversation_id
        )
        response = await client.create_conversation(request=request)
        return {"conversation_name": response.name}
    except Exception as e:
        print(f"DEBUG: Create/Get Conversation Error: {e}", flush=True)
        return {"error": str(e)}


@app.post("/api/chat")
async def chat(request_data: dict):
    # request_data should contain 'messages' (list of message dicts)
    messages_raw = request_data.get('messages', [])
    conversation_name = request_data.get('conversation')
    
    async def event_generator():
        try:
            client = geminidataanalytics.DataChatServiceAsyncClient()
            
            # Convert raw messages to proto Messages
            conversation_messages = []
            for msg in messages_raw:
                try:
                    message = geminidataanalytics.Message()
                    if 'userMessage' in msg:
                        user_msg = msg['userMessage']
                        text = ""
                        if isinstance(user_msg, dict):
                            text = user_msg.get('text', '')
                        elif isinstance(user_msg, str):
                            # Handle cases where it might be a stringified dict
                            if user_msg.strip().startswith('{'):
                                try:
                                    import ast
                                    parsed = ast.literal_eval(user_msg)
                                    if isinstance(parsed, dict):
                                        text = parsed.get('text', user_msg)
                                    else:
                                        text = user_msg
                                except:
                                    text = user_msg
                            else:
                                text = user_msg
                        else:
                            text = str(user_msg)
                        
                        message.user_message.text = str(text)
                    elif 'systemMessage' in msg:
                        # SystemMessage text is a TextMessage field (expects parts list)
                        if isinstance(msg['systemMessage'], dict) and 'text' in msg['systemMessage']:
                            message.system_message.text.parts = [str(msg['systemMessage']['text'])]
                    conversation_messages.append(message)
                except Exception:
                    continue

            # Data Agent Context
            data_agent_context = geminidataanalytics.DataAgentContext()
            data_agent_context.data_agent = f"projects/{BILLING_PROJECT}/locations/{LOCATION}/dataAgents/{DATA_AGENT_ID}"

            chat_request = geminidataanalytics.ChatRequest(
                parent=f"projects/{BILLING_PROJECT}/locations/{LOCATION}",
                messages=conversation_messages,
                conversation_reference={"conversation": conversation_name} if conversation_name else None,
                data_agent_context=data_agent_context,
            )
            
            stream = await client.chat(request=chat_request)
            async for response in stream:
                resp_dict = MessageToDict(response._pb)
                yield f"data: {json.dumps(resp_dict)}\n\n"
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/revenue/group")
async def get_group_revenue():
    try:
        data = bq_client.get_group_revenue()
        df = pd.DataFrame(data)
        
        # Ensure usage_month is string for comparison
        df['usage_month'] = df['usage_month'].astype(str)
        
        # Group summary
        arr_2026 = df[df['usage_month'] >= '2026-01-01']['mrr'].sum()
        
        # Calculate monthly growth
        sorted_df = df.sort_values('usage_month')
        mrr_series = sorted_df.groupby('usage_month')['mrr'].sum().sort_index().values # Sum MRR per month
        
        growth_1m = ((mrr_series[-1] - mrr_series[-2]) / mrr_series[-2] * 100) if len(mrr_series) > 1 and mrr_series[-2] != 0 else 0
        growth_2m = ((mrr_series[-1] - mrr_series[-3]) / mrr_series[-3] * 100) if len(mrr_series) > 2 and mrr_series[-3] != 0 else 0
        growth_3m = ((mrr_series[-1] - mrr_series[-4]) / mrr_series[-4] * 100) if len(mrr_series) > 3 and mrr_series[-4] != 0 else 0
        
        # Pivot for MRR by Entity
        entity_pivot = df.pivot_table(index='usage_month', columns='customer_name_1', values='mrr', aggfunc='sum').fillna(0)
        entity_chart = [{"name": idx, **row} for idx, row in entity_pivot.iterrows()]
        
        # Pivot for CNS SBA (if cns_sba_yn column exists)
        sba_chart = []
        sba_keys = []
        if 'cns_sba_yn' in df.columns:
            # Map boolean/string to descriptive strings robustly
            df['cns_sba_yn_label'] = df['cns_sba_yn'].apply(lambda x: 'CNS SBA' if str(x).strip().lower() == 'true' else 'Others')
            sba_pivot = df.pivot_table(index='usage_month', columns='cns_sba_yn_label', values='mrr', aggfunc='sum').fillna(0)
            sba_chart = [{"name": idx, **row} for idx, row in sba_pivot.iterrows()]
            sba_keys = list(sba_pivot.columns)
            
        return {
            "arr2026": float(arr_2026),
            "growth_1m": round(growth_1m, 1),
            "growth_2m": round(growth_2m, 1),
            "growth_3m": round(growth_3m, 1),
            "entityChart": {
                "chartData": entity_chart,
                "keys": list(entity_pivot.columns)
            },
            "sbaChart": {
                "chartData": sba_chart,
                "keys": sba_keys
            }
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/cache/clear")
async def clear_cache():
    try:
        bq_client.clear_cache()
        return {"status": "success", "message": "Cache cleared"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/revenue/entity")
async def get_entity_revenue(name: str = Query(...)):
    try:
        print(f"DEBUG: get_entity_revenue called for {name}", flush=True)
        # Get global group data for summary reference
        group_data = bq_client.get_group_revenue()
        group_df = pd.DataFrame(group_data)
        group_df['usage_month'] = group_df['usage_month'].astype(str)
        global_arr_2026 = group_df[group_df['usage_month'] >= '2026-01-01']['mrr'].sum()
        print(f"DEBUG: global_arr_2026: {global_arr_2026}", flush=True)

        data = bq_client.get_entity_revenue(name)
        df = pd.DataFrame(data)
        print(f"DEBUG: Data fetched for {name}, df size: {len(df)}", flush=True)
        
        if df.empty:
            return {
                "subChart": {"chartData": [], "keys": []},
                "serviceChart": {"chartData": [], "keys": []},
                "aiChart": {"chartData": [], "keys": []},
                "topProjects": [],
                "topAIProjects12m": [],
                "topAIProjects3m": [],
                "growth3m": [],
                "growth2m": [],
                "arr2026": 0,
                "groupArr2026": float(global_arr_2026)
            }
        
        # Ensure usage_month is string for comparison
        df['usage_month'] = df['usage_month'].astype(str)

        # Process data for charts
        # Data Preprocessing - Core step for all logic
        df['MRR'] = pd.to_numeric(df['MRR'], errors='coerce').fillna(0)
        df['usage_dt'] = pd.to_datetime(df['usage_month'], errors='coerce')
        df['product_l2'] = df['product_l2'].fillna('').str.strip()
        
        # Robustly identify and clean the customer name column
        cust_col = next((c for c in ['customer_name_2', 'customer_name', 'customer'] if c in df.columns), None)
        if cust_col:
            df['customer_name_clean'] = df[cust_col].fillna('').astype(str).str.strip()
        else:
            df['customer_name_clean'] = ''
        
        latest_dt = df['usage_dt'].max()
        if pd.isna(latest_dt):
            latest_dt = pd.Timestamp.now()
        print(f"DEBUG: latest_dt: {latest_dt}", flush=True)

        # 1. Sub-Account Chart
        sub_pivot = df.pivot_table(index='usage_month', columns='customer_name_clean', values='MRR', aggfunc='sum').fillna(0)
        sub_chart = [{"name": idx, **row} for idx, row in sub_pivot.iterrows()]
        print(f"DEBUG: sub_chart generated, rows: {len(sub_chart)}", flush=True)

        # 2. Product Chart
        svc_totals = df.groupby('service_display_name')['MRR'].sum().sort_values(ascending=False)
        top_20_svcs = svc_totals.head(20).index.tolist()
        df['service_group'] = df['service_display_name'].apply(lambda x: x if x in top_20_svcs else 'Others')
        prod_pivot = df.pivot_table(index='usage_month', columns='service_group', values='MRR', aggfunc='sum').fillna(0)
        cols = [c for c in prod_pivot.columns if c != 'Others']
        if 'Others' in prod_pivot.columns:
            cols.append('Others')
        prod_pivot = prod_pivot[cols]
        prod_chart = [{"name": idx, **row} for idx, row in prod_pivot.iterrows()]

        # 3. AI MRR logic
        ai_df_full = df[df['product_l2'] == 'GCP AI'].copy()
        ai_chart = []
        if not ai_df_full.empty:
            ai_pivot = ai_df_full.pivot_table(index='usage_month', columns='service_display_name', values='MRR', aggfunc='sum').fillna(0)
            ai_chart = [{"name": idx, **row} for idx, row in ai_pivot.iterrows()]

        # Helper for robust top-N project list generation
        def get_top_projects(target_df, timeframe_start, limit=10):
            filtered = target_df[target_df['usage_dt'] >= timeframe_start]
            if filtered.empty: return []
            
            # Explicitly aggregate and pick first non-empty customer name
            agg_df = filtered.groupby('project_id').agg({
                'MRR': 'sum',
                'customer_name_clean': lambda x: next((v for v in x if v), '')
            }).sort_values('MRR', ascending=False).head(limit).reset_index()
            
            # Manually construct list of dicts to ensure keys are exactly as expected
            results = []
            for _, row in agg_df.iterrows():
                results.append({
                    "id": str(row['project_id']),
                    "customer_name_2": str(row['customer_name_clean']),
                    "mrr": float(row['MRR'])
                })
            return results

        start_12m = latest_dt - pd.DateOffset(months=11)
        start_3m = latest_dt - pd.DateOffset(months=2)

        top12m_list = get_top_projects(df, start_12m)
        topAI12m_list = get_top_projects(ai_df_full, start_12m) if not ai_df_full.empty else []
        topAI3m_list = get_top_projects(ai_df_full, start_3m) if not ai_df_full.empty else []

        # 5. Growth Calculations
        def get_growth(months):
            recent_start = latest_dt - pd.DateOffset(months=months-1)
            prev_start = latest_dt - pd.DateOffset(months=2*months-1)
            recent_df = df[df['usage_dt'] >= recent_start]
            prev_df = df[(df['usage_dt'] >= prev_start) & (df['usage_dt'] < recent_start)]
            recent_agg = recent_df.groupby(['project_id', 'customer_name_clean'])['MRR'].sum()
            prev_agg = prev_df.groupby(['project_id', 'customer_name_clean'])['MRR'].sum()
            growth_df = pd.DataFrame({'recent': recent_agg, 'prev': prev_agg}).fillna(0)
            growth_df['increase'] = growth_df['recent'] - growth_df['prev']
            return growth_df[growth_df['increase'] > 0].sort_values('increase', ascending=False).head(10).reset_index().rename(columns={'customer_name_clean': 'customer_name_2'}).to_dict(orient='records')

        return {
            "subChart": {"chartData": sub_chart, "keys": list(sub_pivot.columns)},
            "serviceChart": {"chartData": prod_chart, "keys": list(prod_pivot.columns)},
            "aiChart": {"chartData": ai_chart, "keys": list(ai_pivot.columns) if not ai_df_full.empty else []},
            "topProjects": top12m_list,
            "topAIProjects12m": topAI12m_list,
            "topAIProjects3m": topAI3m_list,
            "growth3m": get_growth(3),
            "growth2m": get_growth(2),
            "arr2026": (df[df['usage_dt'] >= '2026-01-01']['MRR'].sum()).round(1) if not df.empty else 0,
            "groupArr2026": float(global_arr_2026)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

# Production Static File Serving
# Mount the built frontend static files
# In a Cloud Run environment, the frontend is built into the 'static' directory
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

# Catch-all route to serve index.html for React routing
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    if os.path.exists("static/index.html"):
        return FileResponse("static/index.html")
    return {"error": "Frontend not found"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    
    print(f"Server starting on port {port}...")
    if os.path.exists("static"):
        print("Mode: Unified (API + Static Frontend) - Matches Cloud Run deployment.")
    else:
        print("Mode: API-only (Standard Dev) - Use frontend dev server for UI.")
        
    uvicorn.run(app, host="0.0.0.0", port=port)
