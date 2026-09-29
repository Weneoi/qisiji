(function() {
    'use strict';

    // ===== 工具函数 =====
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    // Toast
    const toastEl = document.getElementById('toast');
    let toastTimer = null;

    function showToast(msg, type = 'info', duration = 2000) {
        if (toastTimer) {
            clearTimeout(toastTimer);
            toastTimer = null;
        }
        toastEl.textContent = msg;
        toastEl.className = 'show ' + type;

        toastTimer = setTimeout(() => {
            toastEl.classList.remove('show');
            toastTimer = null;
        }, duration);
    }

    // 存储
    const STORAGE = {
        API_URL: 'qisiji_url',
        API_KEY: 'qisiji_key',
        API_MODEL: 'qisiji_model',
        MCP_MASTER: 'mcp_master',
        MCP_SUB_PREFIX: 'mcp_sub_',
        GH_TOKEN: 'qisiji_gh_token',
        GIST_ID: 'qisiji_gist_id',
        CONFIG_VERSION: '1.0',

        get(key, def) {
            const v = localStorage.getItem(key);
            if (v === null) return def;
            try { return JSON.parse(v); } catch { return v; }
        },
        set(key, val) {
            localStorage.setItem(key, JSON.stringify(val));
        },
        remove(key) {
            localStorage.removeItem(key);
        }
    };

    // 获取完整配置
    function getFullConfig() {
        const subToggles = $$('.mcp-sub-toggle');
        const mcpSub = {};
        subToggles.forEach(el => {
            const name = el.dataset.mcp;
            mcpSub[name] = el.checked;
        });

        let model = document.getElementById('api-model-select').value.trim();
        if (!model) {
            model = document.getElementById('api-model-manual').value.trim();
        }

        return {
            version: STORAGE.CONFIG_VERSION,
            api: {
                url: document.getElementById('api-url').value.trim(),
                key: document.getElementById('api-key').value.trim(),
                model: model,
            },
            mcp: {
                master: document.getElementById('mcp-master-toggle').checked,
                subs: mcpSub,
            },
            github: {
                token: document.getElementById('gh-token').value.trim(),
                gistId: document.getElementById('gist-id').value.trim(),
            }
        };
    }

    // ===== 应用配置到 UI（增强版：确保模型填入） =====
    function applyConfig(cfg) {
        if (!cfg) return;
        try {
            // API 配置
            if (cfg.api) {
                document.getElementById('api-url').value = cfg.api.url || '';
                document.getElementById('api-key').value = cfg.api.key || '';
                const modelVal = cfg.api.model || '';
                // 优先填入手动输入框（下拉框可能无选项）
                document.getElementById('api-model-manual').value = modelVal;
                // 同时尝试在下拉框中选中（如果存在）
                const select = document.getElementById('api-model-select');
                const exists = [...select.options].some(opt => opt.value === modelVal);
                if (exists) {
                    select.value = modelVal;
                } else {
                    select.value = '';
                }
            }
            // MCP 配置
            if (cfg.mcp) {
                const master = document.getElementById('mcp-master-toggle');
                master.checked = !!cfg.mcp.master;
                // 子开关
                if (cfg.mcp.subs) {
                    $$('.mcp-sub-toggle').forEach(el => {
                        const name = el.dataset.mcp;
                        if (name in cfg.mcp.subs) {
                            el.checked = !!cfg.mcp.subs[name];
                        }
                    });
                }
                // 触发 UI 更新
                updateMCPSubUI(master.checked);
            }
            // GitHub 配置（可选）
            if (cfg.github) {
                document.getElementById('gh-token').value = cfg.github.token || '';
                document.getElementById('gist-id').value = cfg.github.gistId || '';
            }
        } catch (e) {
            console.error('配置应用异常', e);
        }
    }

    // 保存所有配置到 localStorage
    function persistAllConfigs() {
        STORAGE.set(STORAGE.API_URL, document.getElementById('api-url').value.trim());
        STORAGE.set(STORAGE.API_KEY, document.getElementById('api-key').value.trim());

        let model = document.getElementById('api-model-select').value.trim();
        if (!model) {
            model = document.getElementById('api-model-manual').value.trim();
        }
        STORAGE.set(STORAGE.API_MODEL, model);

        STORAGE.set(STORAGE.MCP_MASTER, document.getElementById('mcp-master-toggle').checked);
        $$('.mcp-sub-toggle').forEach(el => {
            STORAGE.set(STORAGE.MCP_SUB_PREFIX + el.dataset.mcp, el.checked);
        });
        STORAGE.set(STORAGE.GH_TOKEN, document.getElementById('gh-token').value.trim());
        STORAGE.set(STORAGE.GIST_ID, document.getElementById('gist-id').value.trim());
    }

    // 加载本地配置
    function loadAllConfigs() {
        document.getElementById('api-url').value = STORAGE.get(STORAGE.API_URL, '');
        document.getElementById('api-key').value = STORAGE.get(STORAGE.API_KEY, '');
        const savedModel = STORAGE.get(STORAGE.API_MODEL, '');
        const select = document.getElementById('api-model-select');
        const manual = document.getElementById('api-model-manual');
        if (savedModel) {
            const exists = [...select.options].some(opt => opt.value === savedModel);
            if (exists) {
                select.value = savedModel;
                manual.value = '';
            } else {
                select.value = '';
                manual.value = savedModel;
            }
        } else {
            select.value = '';
            manual.value = '';
        }

        const master = document.getElementById('mcp-master-toggle');
        master.checked = STORAGE.get(STORAGE.MCP_MASTER, true);
        master.dispatchEvent(new Event('change'));
        $$('.mcp-sub-toggle').forEach(el => {
            const key = STORAGE.MCP_SUB_PREFIX + el.dataset.mcp;
            el.checked = STORAGE.get(key, true);
        });
        document.getElementById('gh-token').value = STORAGE.get(STORAGE.GH_TOKEN, '');
        document.getElementById('gist-id').value = STORAGE.get(STORAGE.GIST_ID, '');

        updateMCPSubUI(master.checked);
    }

    // MCP 子列表禁用状态
    function updateMCPSubUI(enabled) {
        const list = document.getElementById('mcp-sub-list');
        list.classList.toggle('disabled', !enabled);
    }

    // ===== 1. 页面切换 =====
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPage = document.getElementById('settings-page');
    const closeSettings = document.getElementById('close-settings');

    settingsBtn.addEventListener('click', () => {
        settingsPage.classList.add('active');
        loadAllConfigs();
    });

    closeSettings.addEventListener('click', () => {
        settingsPage.classList.remove('active');
    });

    // ===== 2. 文件夹展开 =====
    const folderToggle = document.getElementById('folder-toggle');
    const glassFolder = document.getElementById('data-hub-folder');

    folderToggle.addEventListener('click', () => {
        glassFolder.classList.toggle('open');
    });

    // ===== 3. MCP 总开关 & 子开关 =====
    const mcpMaster = document.getElementById('mcp-master-toggle');

    mcpMaster.addEventListener('change', (e) => {
        const state = e.target.checked;
        STORAGE.set(STORAGE.MCP_MASTER, state);
        updateMCPSubUI(state);
        $$('.mcp-sub-toggle').forEach(el => {
            STORAGE.set(STORAGE.MCP_SUB_PREFIX + el.dataset.mcp, el.checked);
        });
        showToast(state ? '所有功能已开启' : '所有功能已关闭', 'info', 1500);
    });

    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('mcp-sub-toggle')) {
            const name = e.target.dataset.mcp;
            STORAGE.set(STORAGE.MCP_SUB_PREFIX + name, e.target.checked);
        }
    });

    // ===== 4. 拉取模型列表 =====
    const fetchModelsBtn = document.getElementById('fetch-models-btn');
    const modelSelect = document.getElementById('api-model-select');

    fetchModelsBtn.addEventListener('click', async () => {
        const url = document.getElementById('api-url').value.trim();
        const key = document.getElementById('api-key').value.trim();

        if (!url) {
            showToast('请先填写接口地址', 'error', 2000);
            return;
        }
        if (!key) {
            showToast('请先填写 API KEY', 'error', 2000);
            return;
        }

        fetchModelsBtn.disabled = true;
        fetchModelsBtn.textContent = '加载中...';

        const endpoints = ['/v1/models', '/models'];
        let success = false;

        for (const endpoint of endpoints) {
            try {
                const fullUrl = url.replace(/\/+$/, '') + endpoint;
                const resp = await fetch(fullUrl, {
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!resp.ok) continue;

                const data = await resp.json();
                let models = data.data || data.models || [];
                if (!Array.isArray(models) || models.length === 0) continue;

                const ids = models.map(m => m.id || m).filter(id => id && typeof id === 'string');
                if (ids.length === 0) continue;

                modelSelect.innerHTML = '<option value="">-- 请选择模型 --</option>';
                ids.forEach(id => {
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = id;
                    modelSelect.appendChild(opt);
                });

                const saved = STORAGE.get(STORAGE.API_MODEL, '');
                if (saved && ids.includes(saved)) {
                    modelSelect.value = saved;
                    document.getElementById('api-model-manual').value = '';
                }

                showToast(`成功拉取 ${ids.length} 个模型`, 'success', 2000);
                success = true;
                break;
            } catch (_) {
                // 继续尝试
            }
        }

        if (!success) {
            showToast('拉取失败，请检查接口地址和密钥，或是否支持 /v1/models 或 /models 端点', 'error', 3500);
        }

        fetchModelsBtn.disabled = false;
        fetchModelsBtn.textContent = '拉取模型';
    });

    // ===== 5. 保存配置 =====
    document.getElementById('save-config').addEventListener('click', () => {
        persistAllConfigs();
        showToast('配置已保存', 'success', 1800);
    });

    // ===== 6. 本地导出 / 导入 =====
    const fileInput = document.getElementById('file-input');

    document.getElementById('export-local').addEventListener('click', () => {
        const cfg = getFullConfig();
        const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `qisiji_backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('配置已导出', 'success', 1800);
    });

    document.getElementById('import-local').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!data.version || !data.api || !data.mcp) {
                    throw new Error('无效的备份文件格式');
                }
                applyConfig(data);
                persistAllConfigs();
                showToast('配置已导入并保存', 'success', 2000);
            } catch (err) {
                showToast('导入失败: ' + err.message, 'error', 2500);
            }
        };
        reader.onerror = () => {
            showToast('读取文件失败', 'error', 2000);
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    // ===== 7. GitHub Gist 同步（保留 Token 方式供高级用户） =====
    const ghToken = document.getElementById('gh-token');
    const gistId = document.getElementById('gist-id');

    ghToken.addEventListener('change', () => {
        STORAGE.set(STORAGE.GH_TOKEN, ghToken.value.trim());
    });
    gistId.addEventListener('change', () => {
        STORAGE.set(STORAGE.GIST_ID, gistId.value.trim());
    });

    document.getElementById('sync-push').addEventListener('click', async () => {
        const token = ghToken.value.trim();
        const gist = gistId.value.trim();
        if (!token) {
            showToast('请填写 GitHub Token', 'error', 2000);
            return;
        }
        const cfg = getFullConfig();
        const content = JSON.stringify(cfg, null, 2);
        const fileName = 'qisiji_config.json';

        const btn = document.getElementById('sync-push');
        btn.disabled = true;
        btn.textContent = '上传中...';

        try {
            let url = 'https://api.github.com/gists';
            let method = 'POST';
            let body = {
                description: '起司机配置备份',
                public: false,
                files: { [fileName]: { content } }
            };

            if (gist) {
                url = `https://api.github.com/gists/${gist}`;
                method = 'PATCH';
                body = {
                    description: '起司机配置备份',
                    files: { [fileName]: { content } }
                };
            }

            const resp = await fetch(url, {
                method,
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const result = await resp.json();

            if (!resp.ok) {
                throw new Error(result.message || `HTTP ${resp.status}`);
            }

            if (method === 'POST' && result.id) {
                gistId.value = result.id;
                STORAGE.set(STORAGE.GIST_ID, result.id);
                showToast(`已新建 Gist: ${result.id}`, 'success', 2500);
            } else {
                showToast('云端备份成功', 'success', 2000);
            }
        } catch (err) {
            showToast('备份失败: ' + err.message, 'error', 3000);
        } finally {
            btn.disabled = false;
            btn.textContent = '备份到云端';
        }
    });

    document.getElementById('sync-pull').addEventListener('click', async () => {
        const token = ghToken.value.trim();
        const gist = gistId.value.trim();
        if (!token) {
            showToast('请填写 GitHub Token', 'error', 2000);
            return;
        }
        if (!gist) {
            showToast('请填写 Gist ID', 'error', 2000);
            return;
        }

        const btn = document.getElementById('sync-pull');
        btn.disabled = true;
        btn.textContent = '下载中...';

        try {
            const resp = await fetch(`https://api.github.com/gists/${gist}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.message || `HTTP ${resp.status}`);
            }

            const data = await resp.json();
            const files = data.files || {};
            let content = null;
            for (const key in files) {
                if (key.endsWith('.json') || key === 'qisiji_config.json') {
                    content = files[key].content;
                    break;
                }
            }
            if (!content) {
                for (const key in files) {
                    if (files[key].filename && files[key].filename.endsWith('.json')) {
                        content = files[key].content;
                        break;
                    }
                }
            }
            if (!content) {
                throw new Error('Gist 中未找到 JSON 配置文件');
            }

            const cfg = JSON.parse(content);
            if (!cfg.version || !cfg.api || !cfg.mcp) {
                throw new Error('配置格式无效');
            }
            applyConfig(cfg);
            persistAllConfigs();
            showToast('从云端恢复成功', 'success', 2200);
        } catch (err) {
            showToast('恢复失败: ' + err.message, 'error', 3000);
        } finally {
            btn.disabled = false;
            btn.textContent = '从云端恢复';
        }
    });

    // ===== 8. 自动保存 =====
    ['api-url', 'api-key', 'api-model-manual'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('blur', () => {
            persistAllConfigs();
        });
    });

    modelSelect.addEventListener('change', () => {
        if (modelSelect.value) {
            document.getElementById('api-model-manual').value = '';
        }
        persistAllConfigs();
    });

    // ===== 9. 新增：复制分享链接（生成 ?config= 参数） =====
    document.getElementById('copy-share-link').addEventListener('click', () => {
        const gist = document.getElementById('gist-id').value.trim();
        if (!gist) {
            showToast('请先完成一次备份以获取 Gist ID', 'error', 2000);
            return;
        }

        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?config=${gist}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast('分享链接已复制，朋友点开即可一键部署', 'success', 2500);
            }).catch(() => {
                fallbackCopy(shareUrl);
            });
        } else {
            fallbackCopy(shareUrl);
        }
    });

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('分享链接已复制，朋友点开即可一键部署', 'success', 2500);
        } catch (e) {
            showToast('复制失败，请手动复制链接', 'error', 2000);
        }
        document.body.removeChild(textarea);
    }

    // ===== 10. 初始化：零门槛自动部署 =====
    async function init() {
        // 先加载本地配置（作为兜底）
        loadAllConfigs();

        // 检查 URL 参数（支持 ?config= 或 ?gist= 兼容）
        const urlParams = new URLSearchParams(window.location.search);
        const shareGistId = urlParams.get('config') || urlParams.get('gist');

        if (shareGistId) {
            showToast('正在同步预设配置...', 'info', 2500);

            try {
                // 公开 Gist 无需 Token
                const resp = await fetch(`https://api.github.com/gists/${shareGistId}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                const data = await resp.json();
                const files = data.files;
                let content = null;

                // 寻找第一个 .json 文件
                for (const key in files) {
                    if (key.endsWith('.json')) {
                        content = files[key].content;
                        break;
                    }
                }

                if (content) {
                    const cfg = JSON.parse(content);
                    // 应用配置并保存
                    applyConfig(cfg);
                    persistAllConfigs();
                    showToast('部署成功，欢迎使用起司机', 'success', 3000);
                    // 清除 URL 参数（使链接变干净）
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else {
                    showToast('Gist 中未找到 JSON 配置文件', 'error', 2500);
                }
            } catch (err) {
                showToast('一键部署失败，请检查网络或 Gist ID 是否正确', 'error', 3000);
                console.error(err);
            }
        } else {
            showToast('起司机已就绪', 'info', 1500);
        }

        // 后续 UI 初始化
        glassFolder.classList.remove('open');
        settingsPage.classList.remove('active');
        updateMCPSubUI(mcpMaster.checked);
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();