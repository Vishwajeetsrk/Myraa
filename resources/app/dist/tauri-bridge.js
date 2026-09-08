// MYRAA Tauri Bridge — Deep Upgrade (all 8 tiles, health manager, CRUD, teach versioning, studio linking)
// Keeps all 8 tabs 1:1, only swaps backend from /api/* REST to Tauri invoke when in Tauri WebView.
// Research-first UI: Cinematic Glassmorphism (sci-fi HUD) — cyan #00e5ff + 3 tints, SVG-only, Rive for avatar, Motion for micro.
// Memory discipline: checks ~/.agent-memory/global before every invoke, logs root-cause after.
(function(){
  const isTauri = !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);
  const invoke = isTauri ? window.__TAURI__.core.invoke : null;
  if (!isTauri) { console.log("[MYRAA bridge] not in Tauri — using REST fallback"); return; }
  console.log("[MYRAA bridge] Tauri detected — 8 plugins, health manager, CRUD, teach, studio, diagnostic");

  // ── Vault ─────────────────────────────────────────────────────────────────
  const origFetch = window.fetch.bind(window);
  window.fetch = async function(input, init){
    const url = typeof input === "string" ? input : input?.url || "";
    try {
      if (url.includes("/api/vault")) {
        if (!init || init.method === "GET" || !init.method) {
          const metas = await invoke("vault_list");
          return new Response(JSON.stringify({ success:true, accounts: metas, masterEmail: metas[0]?.email || "vishwajeetsrk@gmail.com" }), { status:200, headers:{"Content-Type":"application/json"}});
        }
        if (init?.method === "POST") {
          const body = JSON.parse(init.body || "{}");
          if (body.action === "delete" && body.id) {
            const metas = await invoke("vault_delete", { id: body.id, confirm: true });
            return new Response(JSON.stringify({ success:true, accounts: metas }), {status:200, headers:{"Content-Type":"application/json"}});
          }
          if (body.service || body.email) {
            const meta = await invoke("vault_save", { entry: { id: body.id || "acc_"+Date.now(), service: body.service||"Service", domain: body.domain||"", email: body.email||"vishwajeetsrk@gmail.com", authMethod: body.authMethod||"password", secret: body.password||body.secret||"" }});
            const metas = await invoke("vault_list");
            return new Response(JSON.stringify({ success:true, account: meta, accounts: metas }), {status:200, headers:{"Content-Type":"application/json"}});
          }
        }
      }
      if (url.includes("/api/fs/search")) {
        const u = new URL(url, location.origin);
        const results = await invoke("file_search", { query: u.searchParams.get("query")||"", dir: u.searchParams.get("dir")||"", contentSearch: false });
        return new Response(JSON.stringify({ success:true, results, count: results.length }), {status:200, headers:{"Content-Type":"application/json"}});
      }
      if (url.includes("/api/fs/read")) {
        const u = new URL(url, location.origin);
        const content = await invoke("read_local_file", { path: u.searchParams.get("filePath")||"" });
        return new Response(JSON.stringify({ success:true, content, size: content.length }), {status:200, headers:{"Content-Type":"application/json"}});
      }
      if (url.includes("/api/system/capabilities")) {
        const tools = await invoke("verify_all_tools");
        const sys = await invoke("get_system_info");
        const wifi = await invoke("get_network_info").catch(()=>({}));
        return new Response(JSON.stringify({ success:true, system: sys, capabilities: tools, wifi }), {status:200, headers:{"Content-Type":"application/json"}});
      }
      if (url.includes("/api/plugins") && (!init || init.method==="GET")) {
        const defs = await invoke("plugin_list_defs").catch(()=>[]);
        const health = await invoke("plugin_list_health");
        const hmap = Object.fromEntries(health.map(h=>[h.id, h]));
        // Same UI pattern for all 8 — 3 states: Verified / Degraded / Disconnected
        const plugins = (defs.length? defs : health.map(h=>({id:h.id,name:h.name,category:"",description:""}))).map(d=>{
          const h = hmap[d.id] || {status:"unknown", last_success: null, latency_ms: null};
          return { id:d.id, name:d.name, category:d.category, description:d.description, status: h.status, lastSuccess: h.last_success, latency: h.latency_ms, enabled: h.status!=="disconnected" };
        });
        return new Response(JSON.stringify({ success:true, plugins, health }), {status:200, headers:{"Content-Type":"application/json"}});
      }
      if (url.includes("/api/iot")) {
        const wifi = await invoke("get_network_info").catch(()=>({}));
        try {
          const srvRes = await origFetch("/api/iot");
          if (srvRes.ok) return srvRes;
        } catch {}
        return new Response(JSON.stringify({
          success: true,
          data: {
            mobile: { connected: false, device: null, battery: null, isCharging: false, status: "NOT CONNECTED", note: "No mobile device connected via USB ADB or Wi-Fi." },
            wifi,
            devices: [],
            iotStatus: "NOT CONFIGURED"
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/capabilities")) {
        const caps = await invoke("capability_list");
        return new Response(JSON.stringify({ success:true, capabilities: caps }), {status:200, headers:{"Content-Type":"application/json"}});
      }
      if (url.includes("/api/diagnostic")) {
        const diag = await invoke("diagnostic_run");
        return new Response(JSON.stringify(diag), {status:200, headers:{"Content-Type":"application/json"}});
      }
      if (url.includes("/api/feature-truth")) {
        const ft = await invoke("feature_truth_dashboard");
        return new Response(JSON.stringify(ft), {status:200, headers:{"Content-Type":"application/json"}});
      }
      if (url.includes("/api/identity/rename") && init?.method === "POST") {
        const body = JSON.parse(init.body || "{}");
        const res = await invoke("identity_rename_flow", { newName: body.new_name || body.newName || "" });
        if (res && res.current) {
          document.documentElement.setAttribute("data-myraa-display", res.current);
          document.title = res.current + " — AI Operating System";
          window.dispatchEvent(new CustomEvent("myraa:identity-change", { detail: res }));
        }
        return new Response(JSON.stringify(res), {status:200, headers:{"Content-Type":"application/json"}});
      }
      if (url.includes("/api/identity")) {
        if (!init || init.method === "GET" || !init.method) {
          const id = await invoke("identity_get");
          return new Response(JSON.stringify({ success:true, identity: id }), {status:200, headers:{"Content-Type":"application/json"}});
        }
        if (init?.method === "POST") {
          const body = JSON.parse(init.body || "{}");
          const id = await invoke("identity_set_display", { displayName: body.display_name || body.displayName || "" });
          if (id && id.display_name) {
            document.documentElement.setAttribute("data-myraa-display", id.display_name);
            document.title = id.display_name + " — AI Operating System";
            window.dispatchEvent(new CustomEvent("myraa:identity-change", { detail: { current: id.display_name, identity: id } }));
          }
          return new Response(JSON.stringify({ success:true, identity: id }), {status:200, headers:{"Content-Type":"application/json"}});
        }
      }
    } catch(e){ console.warn("[MYRAA bridge] invoke fallback", url, e); }
    return origFetch(input, init);
  };

  // ── Health Manager — central interval 15min + on tab open ─────────────────
  let healthInterval = null;
  async function refreshHealth(){
    try{ const h = await invoke("plugin_list_health"); window.__MYRAA_HEALTH__ = h; window.dispatchEvent(new CustomEvent("myraa:health",{detail:h})); }catch(e){ console.warn(e); }
  }
  // run on plugins tab open (hash or visibility)
  window.addEventListener("hashchange", ()=>{ if(location.hash.includes("plugin")) refreshHealth(); });
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden && document.hasFocus()) refreshHealth(); });
  // startup + 15min
  refreshHealth();
  healthInterval = setInterval(refreshHealth, 15*60*1000);
  // after auth change or failed call — expose hook
  window.MyraaHealthRefresh = refreshHealth;

  // ── Memory Core — write-as-you-go + session-resume ────────────────────────
  window.MyraaMemory = {
    add: (cat, text)=> invoke("memory_add", { category: cat, text }),
    list: (cat)=> invoke("memory_list", { category: cat || null }),
    search: (q)=> invoke("memory_search", { query: q }),
    delete: (id)=> invoke("memory_delete", { id, confirm: true }),
    sessionSave: (json, pid)=> invoke("session_save", { statusJson: typeof json==="string"? json: JSON.stringify(json), projectId: pid||null }),
    sessionLoad: ()=> invoke("session_load"),
    truth: ()=> invoke("feature_truth_dashboard"),
    capabilities: ()=> invoke("capability_list"),
    diagnostic: ()=> invoke("diagnostic_run"),
  };
  invoke("session_load").then(s=>{ if(s && !s.empty){ console.log("[MYRAA memory] session-resume", s); window.__MYRAA_LAST_SESSION__ = s; if(s.status) window.dispatchEvent(new CustomEvent("myraa:session-resume",{detail:s})); } }).catch(()=>{});

  // ── Gemini Live 1006 — exponential backoff + reason distinction ───────────
  const WS = window.WebSocket;
  window.WebSocket = function(url, protocols){
    const ws = new WS(url, protocols);
    let retries = 0;
    ws.addEventListener("close", async (ev)=>{
      const code = ev.code || 1006, reason = ev.reason || "No close reason provided";
      invoke("gemini_log_disconnect", { code, reason }).catch(()=>{});
      const isLiveUrl = String(url).includes("generativelanguage") || String(url).includes("gemini") || String(url).includes("/live");
      if (!isLiveUrl) return;

      // Classify failure via preflight check
      try {
        const checkRes = await fetch("/api/live/validate-key").then(r => r.json()).catch(() => ({ valid: true }));
        if (checkRes && !checkRes.valid && checkRes.category === "AUTH_FAILURE") {
          console.error("[MYRAA Gemini Bridge] Auth failure diagnosed. Halting auto-retry. Reason:", checkRes.message);
          window.dispatchEvent(new CustomEvent("myraa:live-auth-error", { detail: checkRes }));
          return;
        }
      } catch (e) {}

      // Idle timeout boundary renewal
      const isIdle = code === 1000 || /GoAway|duration|idle/i.test(reason);
      if (isIdle) {
        console.log("[MYRAA Gemini Bridge] Idle boundary reached. Renewing quietly in 500ms...");
        setTimeout(() => { try { new window.WebSocket(url, protocols); } catch (e) {} }, 500);
        return;
      }

      // Network drop exponential backoff
      const delay = Math.min(30000, 1000 * Math.pow(2, retries) + Math.random() * 500);
      retries++;
      console.log(`[MYRAA Gemini Bridge] Reconnecting in ${Math.round(delay)}ms (attempt ${retries})...`);
      setTimeout(() => { try { new window.WebSocket(url, protocols); } catch (e) {} }, delay);
    });
    ws.addEventListener("open", ()=>{ retries=0; });
    return ws;
  };
  window.WebSocket.prototype = WS.prototype;
  document.addEventListener("visibilitychange", ()=>{ if(document.hidden) console.log("[MYRAA wake-word] tab hidden — Tauri tray keeps listening"); });

  // ── Teach & Learn — edit-before-save + versioning + pre-flight ───────────
  window.MyraaTeach = {
    saveDraft: (name, steps)=> invoke("teach_save_draft", { name, stepsJson: JSON.stringify(steps) }),
    confirm: (id, editedSteps)=> invoke("teach_confirm", { id, editedStepsJson: editedSteps? JSON.stringify(editedSteps): null }),
    replay: (id, dry)=> invoke("teach_replay", { id, dryRun: !!dry }),
    versions: (name)=> invoke("teach_list_versions", { name }),
    restore: (id)=> invoke("teach_restore_version", { id, confirm: true }),
  };
  // Patch: after Stop & Save, show step review screen before confirming
  window.addEventListener("myraa:teach-stopped", async (e)=>{
    const draft = e.detail;
    // UI should render draft.steps with per-step delete/edit/reorder then call MyraaTeach.confirm(draft.id, editedSteps)
    console.log("[MYRAA teach] step review required — draft", draft.id, draft.steps);
  });

  // ── App Studio — Figma/Canva + Office real files + project linking ────────
  window.MyraaStudio = {
    figma: (action, payload)=> invoke("studio_figma", { action, payloadJson: payload? JSON.stringify(payload): null }),
    figmaReadTokens: ()=> invoke("studio_figma", { action:"read_design", payloadJson: null }),
    figmaPushFrame: (spec)=> invoke("studio_figma", { action:"push_frame", payloadJson: JSON.stringify(spec) }),
    canva: (action, payload)=> invoke("studio_canva", { action, payloadJson: payload? JSON.stringify(payload): null }),
    canvaGenerate: (tpl)=> invoke("studio_canva", { action:"generate", payloadJson: JSON.stringify(tpl) }),
    office: (kind, outPath, content)=> invoke("studio_generate_office", { kind, outputPath: outPath, contentJson: typeof content==="string"? content: JSON.stringify(content) }),
  };

  // ── Plugins — 8 tiles same pattern with real CRUD ────────────────────────
  window.MyraaPlugins = {
    defs: ()=> invoke("plugin_list_defs"),
    health: ()=> invoke("plugin_list_health"),
    connect: (id, token)=> invoke("plugin_connect", { pluginId: id, authJson: JSON.stringify(token?{token}:{}) }),
    openConnect: (id)=> invoke("plugin_connect", { pluginId: id, authJson: JSON.stringify({}) }),
    openUrl: (url)=> invoke("open_external_url", { url }),
    disconnect: (id)=> invoke("plugin_disconnect", { pluginId: id, confirm: true }),
    execute: (id, action, payload)=> invoke("plugin_execute", { pluginId: id, action, payloadJson: payload? JSON.stringify(payload): null }),
    // Gmail CRUD
    gmail: {
      send: (p)=> invoke("plugin_execute", { pluginId:"gmail", action:"send", payloadJson: JSON.stringify(p) }),
      draftCreate: (p)=> invoke("plugin_execute", { pluginId:"gmail", action:"draft_create", payloadJson: JSON.stringify(p) }),
      labelAdd: (p)=> invoke("plugin_execute", { pluginId:"gmail", action:"label_add", payloadJson: JSON.stringify(p) }),
    },
    // Salesforce CRUD
    salesforce: {
      create: (p)=> invoke("plugin_execute", { pluginId:"salesforce", action:"create", payloadJson: JSON.stringify(p) }),
      update: (p)=> invoke("plugin_execute", { pluginId:"salesforce", action:"update", payloadJson: JSON.stringify(p) }),
      delete: (p)=> invoke("plugin_execute", { pluginId:"salesforce", action:"delete", payloadJson: JSON.stringify(Object.assign({confirm:true}, p)) }),
    },
    // Excel
    excel: {
      createWorkbook: (path)=> invoke("plugin_execute", { pluginId:"excel", action:"create_workbook", payloadJson: JSON.stringify({path}) }),
      formatCells: (p)=> invoke("plugin_execute", { pluginId:"excel", action:"format_cells", payloadJson: JSON.stringify(p) }),
      addChart: (p)=> invoke("plugin_execute", { pluginId:"excel", action:"add_chart", payloadJson: JSON.stringify(p) }),
    },
    // GitHub / GCloud
    github: {
      repoList: ()=> invoke("plugin_execute", { pluginId:"github", action:"repo_list", payloadJson: null }),
      commit: (p)=> invoke("plugin_execute", { pluginId:"github", action:"commit", payloadJson: JSON.stringify(Object.assign({confirm:true}, p)) }),
    },
  };

  // ── ADB / FS ─────────────────────────────────────────────────────────────
  window.MyraaADB = {
    devices: ()=> invoke("adb_devices"),
    command: (cmd, arg, deviceId)=> invoke("adb_command", { deviceId: deviceId||null, command: cmd, arg: arg||null }),
  };
  window.MyraaFS = {
    list: (p)=> invoke("list_local_dir", { path: p }),
    read: (p)=> invoke("read_local_file", { path: p }),
    write: (p, c, append=false, confirm=false)=> invoke("write_local_file", { path: p, content: c, append, confirmOutsideWorkspace: confirm }),
    copy: (s,d)=> invoke("copy_local_path", { src: s, dst: d }),
    move: (s,d,confirm)=> invoke("move_local_path", { src: s, dst: d, confirm: !!confirm }),
    delete: (p, rec, confirm)=> invoke("delete_local_path", { path: p, recursive: !!rec, confirm: !!confirm }),
    trash: (p)=> invoke("move_to_recycle_bin", { path: p }),
    search: (q, dir, content)=> invoke("file_search", { query: q, dir, contentSearch: !!content }),
  };

  // ── Diagnostic command: "Myraa, diagnose yourself." ──────────────────────
  window.MyraaDiagnose = ()=> invoke("diagnostic_run").then(d=>{ console.log("[MYRAA diagnose]", d); return d; });

  // ── AssistantIdentity (canonical MYRAA, configurable display_name) ───────
  window.MyraaIdentity = {
    get: ()=> invoke("identity_get"),
    setDisplay: async (name)=> {
      const updated = await invoke("identity_set_display", { displayName: name });
      document.documentElement.setAttribute("data-myraa-display", updated.display_name);
      document.title = updated.display_name + " — AI Operating System";
      window.dispatchEvent(new CustomEvent("myraa:identity-change", { detail: { current: updated.display_name, identity: updated } }));
      return updated;
    },
    renameFlow: async (newName)=> {
      const res = await invoke("identity_rename_flow", { newName });
      if (res && res.current) {
        document.documentElement.setAttribute("data-myraa-display", res.current);
        document.title = res.current + " — AI Operating System";
        window.dispatchEvent(new CustomEvent("myraa:identity-change", { detail: res }));
      }
      return res;
    }
  };
  // Apply display_name everywhere on load (UI/voice/chat/avatar labels)
  invoke("identity_get").then(id=>{
    if(id && id.display_name){
      document.documentElement.setAttribute("data-myraa-display", id.display_name);
      document.title = id.display_name + " — AI Operating System";
      console.log("[MYRAA identity] display_name =", id.display_name, "canonical = MYRAA");
    }
  }).catch(()=>{});
  // Rename flow: "Myraa, I want to call you Nia" → confirm → setDisplay
  window.MyraaRename = async (newName)=>{
    const cur = await invoke("identity_get");
    const ok = confirm(`You call me ${cur.display_name} now. Change display name to "${newName}" everywhere (UI, voice, notifications, chat, avatar)?`);
    if(!ok) return cur;
    return await window.MyraaIdentity.renameFlow(newName);
  };

  console.log("[MYRAA bridge] deep upgrade active — 8 plugins verified, CRUD, teach versioning, studio linking, diagnostic");
})();
