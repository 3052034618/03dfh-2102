const API = '';

let currentRoomId = null;
let creatorToken = null;
let currentPlayerId = null;
let creatorPollingInterval = null;
let playerPollingInterval = null;
let lastResultRoleId = null;
let resultShownOnce = false;

const roleTags = ['🔥高能', '😂搞笑', '🔍推理', '😌边缘', '💧情感', '💕情侣', '🎭任意'];
const genderOptions = [
    { value: 'any', label: '不限' },
    { value: 'male', label: '♂男' },
    { value: 'female', label: '♀女' }
];

const birthdayDanmakuMessages = [
    '🎉 生日快乐！',
    '🎂 新的一岁要开心哦~',
    '🎊 愿你每天都像今天一样快乐！',
    '❤️ 我们永远爱你！',
    '🎁 惊喜才刚刚开始！',
    '✨ 愿你所愿皆成真！',
    '🎈 生日快乐鸭！',
    '🥳 今天你就是主角！',
    '🎀 天天开心，岁岁平安！',
    '💝 祝福最可爱的你！'
];

const defaultRoleNames = [
    '大太太', '二少爷', '三小姐', '管家', '司机', '厨子',
    '律师', '医生', '记者', '侦探'
];

document.addEventListener('DOMContentLoaded', function() {
    initModuleSwitch();
    initPlayerCountChange();
    initDefaultRoles();
    loadMyRooms();
    loadServerSurpriseList();
    checkUrlParams();
});

function initModuleSwitch() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const modules = document.querySelectorAll('.module');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetModule = btn.dataset.module;
            navBtns.forEach(b => b.classList.remove('active'));
            modules.forEach(m => m.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`module-${targetModule}`).classList.add('active');
        });
    });
}

function initPlayerCountChange() {
    document.getElementById('playerCount').addEventListener('change', initDefaultRoles);
}

function initDefaultRoles() {
    const count = parseInt(document.getElementById('playerCount').value);
    const container = document.getElementById('rolesContainer');
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        addRoleRow(defaultRoleNames[i] || `角色${i + 1}`);
    }
}

function addRoleRow(defaultName = '') {
    const container = document.getElementById('rolesContainer');
    const row = document.createElement('div');
    row.className = 'role-row';
    const tagOpts = roleTags.map(t => `<option value="${t}">${t}</option>`).join('');
    const genderOpts = genderOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    row.innerHTML = `
        <input type="text" placeholder="角色名" value="${defaultName}" maxlength="15">
        <select class="gender-select">${genderOpts}</select>
        <select class="tag-select">${tagOpts}</select>
        <button class="remove-btn" onclick="removeRoleRow(this)">×</button>
    `;
    container.appendChild(row);
}

function removeRoleRow(btn) {
    const container = document.getElementById('rolesContainer');
    if (container.children.length > 4) {
        btn.parentElement.remove();
    } else {
        showToast('至少需要4个角色哦~', 'error');
    }
}

async function createRoom() {
    const scriptName = document.getElementById('scriptName').value.trim();
    if (!scriptName) { showToast('请输入剧本名称~', 'error'); return; }

    const playerCount = parseInt(document.getElementById('playerCount').value);
    const allowCrossPlay = document.getElementById('allowCrossPlay').checked;
    const birthdayMessage = document.getElementById('birthdayMessage').value.trim();
    const openingSlogan = document.getElementById('openingSlogan').value.trim();
    const surpriseTask = document.getElementById('surpriseTask').value.trim();

    const roles = [];
    const roleRows = document.querySelectorAll('#rolesContainer .role-row');
    roleRows.forEach((row, index) => {
        const nameInput = row.querySelector('input');
        const genderSelect = row.querySelector('.gender-select');
        const tagSelect = row.querySelector('.tag-select');
        roles.push({
            name: nameInput.value.trim() || `角色${index + 1}`,
            gender: genderSelect.value,
            tag: tagSelect.value
        });
    });

    if (roles.length !== playerCount) {
        showToast(`角色数量（${roles.length}个）和玩家人数（${playerCount}人）不一致，请调整~`, 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/api/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scriptName, playerCount, allowCrossPlay, roles, birthdayMessage, openingSlogan, surpriseTask })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || '创建失败', 'error'); return; }

        currentRoomId = data.roomId;
        creatorToken = data.creatorToken;

        saveMyRoom({ roomId: data.roomId, creatorToken: data.creatorToken, scriptName });

        document.getElementById('createFormCard').style.display = 'none';
        document.getElementById('roomManageCard').style.display = 'block';
        document.getElementById('roomId').textContent = data.roomId;
        document.getElementById('roomScriptName').textContent = scriptName;
        document.getElementById('roomPlayerCount').textContent = playerCount;
        document.getElementById('roomCrossPlay').textContent = allowCrossPlay ? '允许' : '不允许';
        document.getElementById('creatorPlayerTotal').textContent = playerCount;

        generateQRCode(data.roomId);
        startCreatorPolling();

        if (birthdayMessage || openingSlogan || surpriseTask) {
            saveSurpriseRecord({ scriptName, birthdayPlayer: '待指定', message: birthdayMessage, slogan: openingSlogan, task: surpriseTask, time: new Date().toLocaleString('zh-CN') });
        }

        showToast('🎉 房间创建成功！', 'success');
        triggerConfetti();
    } catch (e) {
        showToast('网络错误，请检查服务器~', 'error');
    }
}

function generateQRCode(roomId) {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = '';
    if (window.QRCode) {
        new QRCode(qrcodeContainer, { text: url, width: 150, height: 150, colorDark: '#2d3436', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
    } else {
        qrcodeContainer.innerHTML = `<div style="padding:20px;color:var(--text-light);font-size:12px;word-break:break-all;">${url}</div>`;
    }
}

function startCreatorPolling() {
    if (creatorPollingInterval) clearInterval(creatorPollingInterval);
    creatorPollingInterval = setInterval(async () => {
        if (!currentRoomId) return;
        try {
            const res = await fetch(`${API}/api/rooms/${currentRoomId}`);
            const room = await res.json();
            if (room.status === 'lottery-done') {
                showCreatorResults(room);
                clearInterval(creatorPollingInterval);
                return;
            }
            if (room.status === 'finished') {
                showFinishedRoom(room);
                clearInterval(creatorPollingInterval);
                return;
            }
            updateCreatorPlayerList(room);
            checkRoomValidation(room);
            updateAllAvoidRoleOptions(room);
            restoreSavedAvoidRules(room);
        } catch (e) { }
    }, 2000);
}

function saveMyRoom(info) {
    const list = JSON.parse(localStorage.getItem('myCreatorRooms') || '[]');
    const idx = list.findIndex(r => r.roomId === info.roomId);
    if (idx >= 0) list[idx] = info; else list.unshift(info);
    localStorage.setItem('myCreatorRooms', JSON.stringify(list.slice(0, 30)));
    loadMyRooms();
}

function loadMyRooms() {
    const list = JSON.parse(localStorage.getItem('myCreatorRooms') || '[]');
    const container = document.getElementById('myRoomsList');
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = '<small style="color:var(--text-light);">暂无房间，创建一个试试吧~</small>';
        return;
    }
    container.innerHTML = '';
    list.forEach(r => {
        const item = document.createElement('div');
        item.className = 'my-room-item';
        item.innerHTML = `
            <div class="my-room-meta">
                <div class="my-room-name">🎬 ${r.scriptName || '未命名剧本'}</div>
                <div class="my-room-id">房间号 ${r.roomId}</div>
            </div>
            <button class="btn btn-primary btn-small" onclick="enterRoomManage('${r.roomId}')">进入管理</button>
        `;
        container.appendChild(item);
    });
}

async function enterRoomManage(roomId) {
    const list = JSON.parse(localStorage.getItem('myCreatorRooms') || '[]');
    const info = list.find(r => r.roomId === roomId);
    if (!info) { showToast('找不到该房间的管理信息', 'error'); return; }
    try {
        const res = await fetch(`${API}/api/rooms/${roomId}`);
        const room = await res.json();
        if (!res.ok) { showToast(room.error || '房间不存在', 'error'); return; }
        currentRoomId = roomId;
        creatorToken = info.creatorToken;
        document.getElementById('createFormCard').style.display = 'none';
        document.getElementById('myRoomsCard').style.display = 'none';
        if (room.status === 'waiting') {
            showCreatorRoomManage(room);
        } else if (room.status === 'lottery-done') {
            showCreatorResults(room);
        } else if (room.status === 'finished') {
            showFinishedRoom(room);
        }
    } catch (e) { showToast('网络错误', 'error'); }
}

function showCreatorRoomManage(room) {
    document.getElementById('roomManageCard').style.display = 'block';
    document.getElementById('lotteryDoneCard').style.display = 'none';
    document.getElementById('finishedCard').style.display = 'none';
    document.getElementById('roomId').textContent = room.id;
    document.getElementById('roomScriptName').textContent = room.scriptName;
    document.getElementById('roomPlayerCount').textContent = room.playerCount;
    document.getElementById('roomCrossPlay').textContent = room.allowCrossPlay ? '允许' : '不允许';
    document.getElementById('creatorPlayerTotal').textContent = room.playerCount;
    generateQRCode(room.id);
    updateCreatorPlayerList(room);
    checkRoomValidation(room);
    restoreSavedAvoidRules(room);
    startCreatorPolling();
}

function updateAllAvoidRoleOptions(room) {
    document.querySelectorAll('#creatorAvoidRules .avoid-rule-role').forEach(sel => {
        fillRoleOptions(room, sel);
    });
}

function fillRoleOptions(room, selectEl) {
    const curVal = selectEl.value;
    selectEl.innerHTML = '<option value="">选择角色</option>';
    if (room && room.roles) {
        room.roles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name + '（' + r.tag + '）';
            selectEl.appendChild(opt);
        });
    }
    if (curVal !== undefined && curVal !== '') selectEl.value = curVal;
}

function updateCreatorPlayerList(room) {
    document.getElementById('creatorPlayerCount').textContent = room.players.length;
    const container = document.getElementById('creatorPlayerList');
    container.innerHTML = '';

    if (room.players.length === 0) {
        container.innerHTML = '<small style="color:var(--text-light);">等待玩家加入...</small>';
        document.getElementById('birthdaySelectGroup').style.display = 'none';
        document.getElementById('avoidRulesGroup').style.display = 'none';
        return;
    }

    room.players.forEach(player => {
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        const isBirthday = room.birthdayPlayerId === player.id;
        if (isBirthday) {
            chip.classList.add('birthday');
            chip.innerHTML = `<span>🎂</span><span>${player.nickname}</span><span class="player-gender-tag ${player.gender}">${player.gender === 'male' ? '♂' : '♀'}</span>`;
        } else {
            chip.innerHTML = `<span>👤</span><span>${player.nickname}</span><span class="player-gender-tag ${player.gender}">${player.gender === 'male' ? '♂' : '♀'}</span>`;
        }
        container.appendChild(chip);
    });

    if (room.players.length >= 1) {
        document.getElementById('birthdaySelectGroup').style.display = 'block';
        updateBirthdayPlayerSelect(room);
    }
    if (room.players.length >= 2) {
        document.getElementById('avoidRulesGroup').style.display = 'block';
        updateAvoidRulePlayerOptions(room);
    }
}

function updateBirthdayPlayerSelect(room) {
    const container = document.getElementById('birthdayPlayerSelect');
    container.innerHTML = '';
    const noneBtn = document.createElement('button');
    noneBtn.className = 'birthday-player-btn' + (room.birthdayPlayerId === null ? ' selected' : '');
    noneBtn.textContent = '暂不指定';
    noneBtn.onclick = () => setBirthdayPlayer(null);
    container.appendChild(noneBtn);

    room.players.forEach(player => {
        const btn = document.createElement('button');
        const isSelected = room.birthdayPlayerId === player.id;
        btn.className = 'birthday-player-btn' + (isSelected ? ' selected' : '');
        btn.textContent = `${player.nickname}（${player.gender === 'male' ? '♂' : '♀'}）`;
        btn.onclick = () => setBirthdayPlayer(player.id);
        container.appendChild(btn);
    });
}

async function setBirthdayPlayer(playerId) {
    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/birthday`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, creatorToken })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || '设置失败', 'error'); return; }
        showToast(playerId ? '🎂 已指定寿星！' : '已取消寿星指定', 'success');
        updateCreatorPlayerList(data.room);
    } catch (e) { showToast('网络错误', 'error'); }
}

function updateAvoidRulePlayerOptions(room) {
    document.querySelectorAll('#creatorAvoidRules .avoid-rule-player').forEach(select => {
        const curVal = select.value;
        select.innerHTML = '<option value="">选择玩家</option>';
        room.players.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.nickname}（${p.gender === 'male' ? '♂' : '♀'}）`;
            select.appendChild(opt);
        });
        if (curVal) select.value = curVal;
    });
}

function addCreatorAvoidRule() {
    const container = document.getElementById('creatorAvoidRules');
    const tagOptions = roleTags.map(t => `<option value="${t}">${t}</option>`).join('');

    const row = document.createElement('div');
    row.className = 'avoid-rule-item';
    row.innerHTML = `
        <select class="avoid-rule-player" style="min-width:100px;">
            <option value="">选择玩家</option>
        </select>
        <span style="color:var(--text-light);font-size:13px;">避开</span>
        <select class="avoid-rule-type" style="width:80px;">
            <option value="tag">标签</option>
            <option value="role">角色</option>
        </select>
        <select class="avoid-rule-tag" style="min-width:90px;">
            ${tagOptions}
        </select>
        <select class="avoid-rule-role" style="display:none;min-width:90px;">
            <option value="">选择角色</option>
        </select>
        <button class="remove-btn" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);

    const typeSelect = row.querySelector('.avoid-rule-type');
    const tagSelect = row.querySelector('.avoid-rule-tag');
    const roleSelect = row.querySelector('.avoid-rule-role');

    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'tag') {
            tagSelect.style.display = '';
            roleSelect.style.display = 'none';
        } else {
            tagSelect.style.display = 'none';
            roleSelect.style.display = '';
        }
        markAvoidRulesDirty();
    });
    row.querySelectorAll('select').forEach(sel => {
        if (sel !== typeSelect) {
            sel.addEventListener('change', markAvoidRulesDirty);
        }
    });

    fetch(`${API}/api/rooms/${currentRoomId}`).then(r => r.json()).then(room => {
        updateAvoidRulePlayerOptions(room);
        fillRoleOptions(room, roleSelect);
    });
}

function markAvoidRulesDirty() {
    const status = document.getElementById('avoidRulesStatus');
    if (status) {
        status.style.display = 'inline-block';
        status.textContent = '📝 规则未保存';
        status.style.color = 'var(--warning)';
    }
}

function markAvoidRulesSaved() {
    const status = document.getElementById('avoidRulesStatus');
    if (status) {
        status.style.display = 'inline-block';
        status.textContent = '✅ 规则已保存';
        status.style.color = 'var(--success)';
        setTimeout(() => { status.style.display = 'none'; }, 2000);
    }
}

function collectAvoidRules() {
    const rules = [];
    document.querySelectorAll('#creatorAvoidRules .avoid-rule-item').forEach(row => {
        const playerId = row.querySelector('.avoid-rule-player').value;
        const type = row.querySelector('.avoid-rule-type').value;
        if (!playerId) return;
        if (type === 'tag') {
            const avoidTag = row.querySelector('.avoid-rule-tag').value;
            if (avoidTag) rules.push({ type, playerId, avoidTag });
        } else {
            const avoidRoleId = parseInt(row.querySelector('.avoid-rule-role').value);
            if (!isNaN(avoidRoleId)) rules.push({ type, playerId, avoidRoleId });
        }
    });
    return rules;
}

async function saveAvoidRules() {
    const rules = collectAvoidRules();
    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/avoid`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorToken, rules })
        });
        if (res.ok) markAvoidRulesSaved(); else showToast('保存失败', 'error');
    } catch (e) { showToast('网络错误，保存失败', 'error'); }
}

let _lastAvoidRulesKey = null;
function restoreSavedAvoidRules(room) {
    const cur = JSON.stringify(room.avoidRules || []);
    if (_lastAvoidRulesKey === cur) return;
    _lastAvoidRulesKey = cur;
    const container = document.getElementById('creatorAvoidRules');
    if (!container) return;
    if (container.children.length > 0) return;
    if (!room.avoidRules || room.avoidRules.length === 0) return;
    container.innerHTML = '';
    for (const rule of room.avoidRules) {
        const row = document.createElement('div');
        row.className = 'avoid-rule-item';

        const tagOptsHtml = roleTags.map(function(t) {
            const sel = (rule.type === 'tag' && rule.avoidTag === t) ? ' selected' : '';
            return '<option value="' + t + '"' + sel + '>' + t + '</option>';
        }).join('');

        row.innerHTML = '' +
            '<select class="avoid-rule-player" style="min-width:100px;">' +
            '<option value="">选择玩家</option>' +
            '</select>' +
            '<span style="color:var(--text-light);font-size:13px;">避开</span>' +
            '<select class="avoid-rule-type" style="width:80px;">' +
            '<option value="tag"' + (rule.type === 'tag' ? ' selected' : '') + '>标签</option>' +
            '<option value="role"' + (rule.type === 'role' ? ' selected' : '') + '>角色</option>' +
            '</select>' +
            '<select class="avoid-rule-tag" style="min-width:90px; display:' + (rule.type === 'tag' ? '' : 'none') + ';">' +
            tagOptsHtml +
            '</select>' +
            '<select class="avoid-rule-role" style="min-width:90px; display:' + (rule.type === 'role' ? '' : 'none') + ';">' +
            '<option value="">选择角色</option>' +
            '</select>' +
            '<button class="remove-btn" onclick="this.parentElement.remove();markAvoidRulesDirty()">×</button>';

        container.appendChild(row);
        row.querySelector('.avoid-rule-type').addEventListener('change', function() {
            const tSel = row.querySelector('.avoid-rule-tag');
            const rSel = row.querySelector('.avoid-rule-role');
            if (row.querySelector('.avoid-rule-type').value === 'tag') {
                tSel.style.display = '';
                rSel.style.display = 'none';
            } else {
                tSel.style.display = 'none';
                rSel.style.display = '';
            }
            markAvoidRulesDirty();
        });
        row.querySelectorAll('select').forEach(function(sel) {
            if (!sel.classList.contains('avoid-rule-type')) {
                sel.addEventListener('change', markAvoidRulesDirty);
            }
        });
    }
    updateAvoidRulePlayerOptions(room);
    updateAllAvoidRoleOptions(room);
}

async function collectAndSaveAvoidRules() {
    // 兼容老的保存
    await saveAvoidRules();
}

function checkRoomValidation(room) {
    const btn = document.getElementById('startLotteryBtn');
    const warningBox = document.getElementById('genderValidationMsg');
    const warningText = document.getElementById('genderWarningText');

    if (room.players.length === 0) { warningBox.style.display = 'none'; btn.disabled = true; btn.style.opacity = '0.5'; return; }
    if (room.roles.length !== room.playerCount) {
        warningBox.style.display = 'block';
        warningText.innerHTML = `⚠️ 角色数量不匹配：设置了 ${room.playerCount} 位玩家，但有 ${room.roles.length} 个角色。${room.roles.length < room.playerCount ? '角色不够，请添加角色' : '角色太多，请删除角色'}。`;
        btn.disabled = true; btn.style.opacity = '0.5'; return;
    }
    if (room.players.length < room.playerCount) { warningBox.style.display = 'none'; btn.disabled = true; btn.style.opacity = '0.5'; return; }
    if (!room.allowCrossPlay) {
        const maleRoles = room.roles.filter(r => r.gender === 'male').length;
        const femaleRoles = room.roles.filter(r => r.gender === 'female').length;
        const anyRoles = room.roles.filter(r => r.gender === 'any').length;
        const malePlayers = room.players.filter(p => p.gender === 'male').length;
        const femalePlayers = room.players.filter(p => p.gender === 'female').length;
        const maleShort = Math.max(0, malePlayers - maleRoles);
        const femaleShort = Math.max(0, femalePlayers - femaleRoles);
        if (maleShort + femaleShort > anyRoles) {
            warningBox.style.display = 'block';
            warningText.innerHTML = `⚠️ 性别匹配失败：有 ${malePlayers} 个男玩家但只有 ${maleRoles} 个男角色，有 ${femalePlayers} 个女玩家但只有 ${femaleRoles} 个女角色。"不限"角色仅 ${anyRoles} 个，不足以补差。请开启反串或调整角色性别。`;
            btn.disabled = true; btn.style.opacity = '0.5'; return;
        }
    }
    warningBox.style.display = 'none'; btn.disabled = false; btn.style.opacity = '1';
}

async function startLottery() {
    await collectAndSaveAvoidRules();
    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/lottery`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorToken })
        });
        const data = await res.json();
        if (!res.ok) {
            document.getElementById('genderErrorText').textContent = data.error || '抽签失败';
            document.getElementById('genderErrorModal').style.display = 'flex';
            return;
        }
        showToast('🎲 抽签开始！', 'success');
        showCreatorResults(data.room);
    } catch (e) { showToast('网络错误', 'error'); }
}

function showCreatorResults(room) {
    clearInterval(creatorPollingInterval);
    document.getElementById('roomManageCard').style.display = 'none';
    document.getElementById('finishedCard').style.display = 'none';
    document.getElementById('lotteryDoneCard').style.display = 'block';

    renderResultList(room);
}

function showFinishedRoom(room) {
    clearInterval(creatorPollingInterval);
    document.getElementById('roomManageCard').style.display = 'none';
    document.getElementById('lotteryDoneCard').style.display = 'none';
    document.getElementById('finishedCard').style.display = 'block';
    const container = document.getElementById('finishedResultList');
    container.innerHTML = '';
    room.players.forEach(player => {
        const role = room.lotteryResults[player.id];
        if (!role) return;
        const isBirthday = room.birthdayPlayerId === player.id;
        const item = document.createElement('div');
        item.className = 'result-item' + (isBirthday ? ' is-birthday' : '');
        item.innerHTML = `
            <span class="result-item-player">
                ${isBirthday ? '🎂 ' : ''}${player.nickname}
                <span class="player-gender-tag ${player.gender}">${player.gender === 'male' ? '♂' : '♀'}</span>
            </span>
            <span class="result-item-role">${role.name} ${role.tag}</span>
        `;
        container.appendChild(item);
    });
}

async function finishRoom() {
    if (!confirm('确定结束房间吗？结束后玩家只能查看最终结果和生日彩蛋，无法再修改。')) return;
    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/finish`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorToken })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || '结束失败', 'error'); return; }
        showToast('🏁 房间已结束', 'success');
        showFinishedRoom(data.room);
    } catch (e) { showToast('网络错误', 'error'); }
}

async function exportRoomResult() {
    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/export`);
        const data = await res.json();
        if (!res.ok) { showToast(data.error || '导出失败', 'error'); return; }
        navigator.clipboard.writeText(data.text).then(() => {
            showToast('📋 结果已复制，直接粘贴到群里吧', 'success');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = data.text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('📋 结果已复制', 'success');
        });
    } catch (e) { showToast('网络错误', 'error'); }
}

let _pendingRedoType = null;

async function redoLottery() {
    _pendingRedoType = 'all';
    await openRedoConfirm([]);
}

async function lockAndRedoLottery() {
    const lockedPlayerIds = [];
    document.querySelectorAll('.lock-checkbox:checked').forEach(cb => {
        lockedPlayerIds.push(cb.dataset.playerId);
    });
    if (lockedPlayerIds.length === 0) {
        if (!confirm('没有锁定任何玩家，将执行全部重抽。继续吗？')) return;
    }
    _pendingRedoType = lockedPlayerIds.length > 0 ? 'locked' : 'all';
    await openRedoConfirm(lockedPlayerIds);
}

async function openRedoConfirm(lockedPlayerIds) {
    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}`);
        const room = await res.json();
        if (!res.ok) { showToast('获取房间信息失败', 'error'); return; }

        const locked = new Set(lockedPlayerIds);
        const keptList = room.players.filter(p => locked.has(p.id));
        const redoList = room.players.filter(p => !locked.has(p.id));

        const avoidMap = {};
        for (const rule of room.avoidRules || []) {
            if (!avoidMap[rule.playerId]) avoidMap[rule.playerId] = [];
            if (rule.type === 'tag') avoidMap[rule.playerId].push(`避开标签「${rule.avoidTag}」`);
            else if (rule.type === 'role') {
                const r = room.roles.find(x => x.id === rule.avoidRoleId);
                if (r) avoidMap[rule.playerId].push(`避开角色「${r.name}」`);
            }
        }

        const html = [];
        if (keptList.length > 0) {
            html.push('<p style="font-weight:600;color:var(--success);margin-bottom:8px;">🔒 以下玩家保留当前角色：</p>');
            html.push('<div style="margin-bottom:14px;">');
            keptList.forEach(p => {
                const role = room.lotteryResults[p.id];
                html.push(`<div class="confirm-player-item">${p.nickname} <span class="player-gender-tag ${p.gender}">${p.gender === 'male' ? '♂' : '♀'}</span>  →  ${role ? role.name + ' ' + role.tag : '无'}</div>`);
            });
            html.push('</div>');
        }
        html.push('<p style="font-weight:600;color:var(--primary);margin-bottom:8px;">🔄 以下玩家将重抽角色：</p>');
        html.push('<div style="margin-bottom:14px;">');
        redoList.forEach(p => {
            const role = room.lotteryResults[p.id];
            html.push(`<div class="confirm-player-item">${p.nickname} <span class="player-gender-tag ${p.gender}">${p.gender === 'male' ? '♂' : '♀'}</span>  →  当前: ${role ? role.name + ' ' + role.tag : '无'}`);
            if (avoidMap[p.id]) html.push(`<div style="font-size:12px;color:var(--text-light);margin-left:22px;margin-top:2px;">${avoidMap[p.id].join('；')}</div>`);
            html.push('</div>');
        });
        html.push('</div>');
        html.push('<p style="font-size:13px;color:var(--text-light);">重抽后玩家手机端会自动刷新到新结果。确认执行？</p>');

        document.getElementById('redoConfirmBody').innerHTML = html.join('');
        document.getElementById('redoConfirmModal').style.display = 'flex';

        const okBtn = document.getElementById('redoConfirmOkBtn');
        okBtn.onclick = async () => {
            document.getElementById('redoConfirmModal').style.display = 'none';
            await executeRedo(lockedPlayerIds);
        };
    } catch (e) { showToast('网络错误', 'error'); }
}

function closeRedoConfirmModal() {
    document.getElementById('redoConfirmModal').style.display = 'none';
}

async function executeRedo(lockedPlayerIds) {
    try {
        await fetch(`${API}/api/rooms/${currentRoomId}/lock`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorToken, lockedPlayerIds })
        });
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/redo-lottery`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorToken })
        });
        const data = await res.json();
        if (!res.ok) {
            document.getElementById('genderErrorText').textContent = data.error || '重抽失败';
            document.getElementById('genderErrorModal').style.display = 'flex';
            return;
        }
        showToast('🎲 重抽成功！', 'success');
        renderResultList(data.room);
    } catch (e) { showToast('网络错误', 'error'); }
}

function renderResultList(room) {
    const container = document.getElementById('creatorResultList');
    container.innerHTML = '';

    const locked = new Set(room.lockedPlayers || []);

    room.players.forEach(player => {
        const role = room.lotteryResults[player.id];
        if (!role) return;
        const isBirthday = room.birthdayPlayerId === player.id;
        const isLocked = locked.has(player.id);

        const item = document.createElement('div');
        item.className = 'result-item' + (isBirthday ? ' is-birthday' : '');
        item.innerHTML = `
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" class="lock-checkbox" data-player-id="${player.id}" ${isLocked ? 'checked' : ''}>
                <span class="result-item-player">
                    ${isBirthday ? '🎂 ' : ''}${player.nickname}
                    <span class="player-gender-tag ${player.gender}">${player.gender === 'male' ? '♂' : '♀'}</span>
                    ${isLocked ? '<span style="color:var(--success);font-size:12px;">🔒锁定</span>' : ''}
                </span>
            </label>
            <span class="result-item-role">${role.name} ${role.tag}</span>
        `;
        container.appendChild(item);
    });

    const redoInfo = document.getElementById('redoInfo');
    const redoBtn = document.getElementById('redoLotteryBtn');
    const lockBtn = document.getElementById('lockAndRedoBtn');

    if (room.redoCount) {
        redoInfo.style.display = 'block';
        redoInfo.textContent = `已重抽 ${room.redoCount} 次`;
    }

    redoBtn.style.display = 'inline-flex';
    lockBtn.style.display = 'inline-flex';

    document.querySelectorAll('.lock-checkbox').forEach(cb => {
        cb.addEventListener('change', updateRedoPreview);
    });
}

function updateRedoPreview() {
    const checked = document.querySelectorAll('.lock-checkbox:checked');
    const redoInfo = document.getElementById('redoInfo');
    redoInfo.style.display = 'block';
    if (checked.length > 0) {
        redoInfo.textContent = `将锁定 ${checked.length} 人，重抽其余玩家`;
    } else {
        redoInfo.textContent = '全部玩家将重新抽签';
    }
}

function closeGenderErrorModal() {
    document.getElementById('genderErrorModal').style.display = 'none';
}

async function joinRoom() {
    const roomId = document.getElementById('joinRoomId').value.trim();
    if (!roomId || roomId.length !== 6) { showToast('请输入6位房间号~', 'error'); return; }

    try {
        const res = await fetch(`${API}/api/rooms/${roomId}`);
        const room = await res.json();
        if (!res.ok) { showToast(room.error || '房间不存在', 'error'); return; }
        if (room.status === 'finished') {
            currentRoomId = roomId;
            const savedPlayerId = localStorage.getItem(`player_${roomId}`);
            if (!savedPlayerId) {
                showToast('房间已结束，请使用你之前加入时的同一台设备查看结果', 'error');
                return;
            }
            currentPlayerId = savedPlayerId;
            document.getElementById('joinRoomCard').style.display = 'none';
            fetchAndShowResult();
            return;
        }
        if (room.status === 'lottery-done') {
            currentRoomId = roomId;
            document.getElementById('joinRoomCard').style.display = 'none';
            document.getElementById('waitingCard').style.display = 'block';
            document.getElementById('waitingRoomName').textContent = room.scriptName;
            document.getElementById('waitingTotal').textContent = room.playerCount;
            document.getElementById('waitingPlayerCount').textContent = room.players.length;
            showToast('此房间已开奖，等待查看结果...', 'info');
            currentPlayerId = localStorage.getItem(`player_${roomId}`);
            if (currentPlayerId) {
                startPlayerPolling();
            } else {
                document.getElementById('waitingCard').style.display = 'none';
                document.getElementById('playerInfoCard').style.display = 'block';
                document.getElementById('joinScriptName').textContent = room.scriptName;
            }
            return;
        }

        currentRoomId = roomId;
        document.getElementById('joinRoomCard').style.display = 'none';
        document.getElementById('playerInfoCard').style.display = 'block';
        document.getElementById('joinScriptName').textContent = room.scriptName;
        showToast('✅ 找到房间啦！', 'success');
    } catch (e) { showToast('网络错误，请检查连接~', 'error'); }
}

async function submitPlayerInfo() {
    const nickname = document.getElementById('playerNickname').value.trim();
    if (!nickname) { showToast('请输入你的昵称~', 'error'); return; }

    const preference = document.querySelector('input[name="preference"]:checked').value;
    const gender = document.querySelector('input[name="gender"]:checked').value;

    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/join`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, preference, gender })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || '加入失败', 'error'); return; }

        currentPlayerId = data.playerId;
        localStorage.setItem(`player_${currentRoomId}`, currentPlayerId);

        document.getElementById('playerInfoCard').style.display = 'none';
        document.getElementById('waitingCard').style.display = 'block';
        document.getElementById('waitingRoomName').textContent = data.room.scriptName;
        document.getElementById('waitingTotal').textContent = data.room.playerCount;

        updateWaitingPlayerList(data.room);
        startPlayerPolling();
        showToast('🎉 加入成功！等待抽签~', 'success');
    } catch (e) { showToast('网络错误', 'error'); }
}

function startPlayerPolling() {
    if (playerPollingInterval) clearInterval(playerPollingInterval);
    playerPollingInterval = setInterval(async () => {
        if (!currentRoomId || !currentPlayerId) return;
        try {
            const res = await fetch(`${API}/api/rooms/${currentRoomId}`);
            const room = await res.json();
            if (room.status !== 'lottery-done') {
                updateWaitingPlayerList(room);
                return;
            }
            const currentRole = room.lotteryResults[currentPlayerId];
            if (currentRole && currentRole.id !== lastResultRoleId) {
                lastResultRoleId = currentRole.id;
                fetchAndShowResult();
            }
        } catch (e) { }
    }, 2000);
}

function updateWaitingPlayerList(room) {
    document.getElementById('waitingPlayerCount').textContent = room.players.length;
    const container = document.getElementById('waitingPlayersList');
    container.innerHTML = '';
    room.players.forEach(player => {
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        const isMe = player.id === currentPlayerId;
        const isBirthday = room.birthdayPlayerId === player.id;
        if (isBirthday) {
            chip.classList.add('birthday');
            chip.innerHTML = `<span>🎂</span><span>${player.nickname}</span>`;
        } else if (isMe) {
            chip.classList.add('ready');
            chip.innerHTML = `<span>✨</span><span>${player.nickname}（你）</span>`;
        } else {
            chip.innerHTML = `<span>👤</span><span>${player.nickname}</span>`;
        }
        container.appendChild(chip);
    });
}

async function fetchAndShowResult() {
    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/result/${currentPlayerId}`);
        const data = await res.json();
        if (!res.ok) { showToast(data.error || '获取结果失败', 'error'); return; }
        showLotteryResult(data);
    } catch (e) { showToast('网络错误', 'error'); }
}

function showLotteryResult(data) {
    const { role, isBirthday, birthdayMessage, openingSlogan } = data;
    const isRefresh = resultShownOnce;
    resultShownOnce = true;

    document.getElementById('waitingCard').style.display = 'none';
    document.getElementById('lotteryResultCard').style.display = 'block';

    if (isBirthday) {
        document.getElementById('birthdayAnimation').style.display = 'block';
        document.getElementById('birthdayExtra').style.display = 'block';
        document.getElementById('birthdayMessageDisplay').textContent = birthdayMessage || '生日快乐！愿你天天开心~';
        if (openingSlogan) {
            document.getElementById('openingSloganDisplay').style.display = 'block';
            document.getElementById('sloganText').textContent = openingSlogan;
            document.getElementById('sloganBtn').style.display = 'block';
        }
        document.getElementById('resultTitle').textContent = '🎂 寿星专属角色是...';
        if (!isRefresh) {
            triggerConfetti();
            triggerDanmaku(birthdayMessage);
        }
    } else {
        document.getElementById('birthdayAnimation').style.display = 'none';
        document.getElementById('birthdayExtra').style.display = 'none';
        document.getElementById('sloganBtn').style.display = 'none';
        document.getElementById('resultTitle').textContent = '🎭 你的角色是...';
    }

    document.getElementById('roleAvatar').textContent = role.avatar;
    document.getElementById('roleName').textContent = role.name;

    const tagsContainer = document.getElementById('roleTags');
    tagsContainer.innerHTML = '';
    const tagSpan = document.createElement('span');
    tagSpan.className = 'role-tag';
    tagSpan.textContent = role.tag;
    tagsContainer.appendChild(tagSpan);
    if (role.gender !== 'any') {
        const gSpan = document.createElement('span');
        gSpan.className = 'role-tag';
        gSpan.textContent = role.gender === 'male' ? '♂男' : '♀女';
        tagsContainer.appendChild(gSpan);
    }

    document.getElementById('roleCostume').textContent = role.costume;
    document.getElementById('roleLine').textContent = role.line;

    if (isRefresh) {
        showToast('🔄 角色已更新！', 'info');
    }
}

function showSloganModal() {
    const sloganText = document.getElementById('sloganText').textContent;
    if (!sloganText) return;
    document.getElementById('bigSloganText').textContent = sloganText;
    document.getElementById('sloganModal').style.display = 'flex';
    triggerConfetti();
}

function closeSloganModal() {
    document.getElementById('sloganModal').style.display = 'none';
    showToast('🎉 太棒了！', 'success');
}

function triggerConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#ff6b9d', '#a29bfe', '#fdcb6e', '#00b894', '#74b9ff', '#ff7675'];
    for (let i = 0; i < 60; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
            const shapes = ['circle', 'square', 'triangle'];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            if (shape === 'circle') { confetti.style.borderRadius = '50%'; }
            else if (shape === 'triangle') {
                confetti.style.width = '0'; confetti.style.height = '0';
                confetti.style.borderLeft = '6px solid transparent';
                confetti.style.borderRight = '6px solid transparent';
                confetti.style.borderBottom = '12px solid ' + colors[Math.floor(Math.random() * colors.length)];
                confetti.style.backgroundColor = 'transparent';
            }
            container.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }, i * 30);
    }
}

function triggerDanmaku(customMessage) {
    const container = document.getElementById('danmakuContainer');
    const messages = [...birthdayDanmakuMessages];
    if (customMessage) messages.unshift('💌 ' + customMessage);
    messages.forEach((msg, index) => {
        setTimeout(() => {
            const danmaku = document.createElement('div');
            danmaku.className = 'danmaku-item';
            danmaku.textContent = msg;
            danmaku.style.top = (10 + Math.random() * 60) + '%';
            danmaku.style.animationDuration = (5 + Math.random() * 3) + 's';
            danmaku.style.fontSize = (14 + Math.random() * 6) + 'px';
            container.appendChild(danmaku);
            setTimeout(() => danmaku.remove(), 9000);
        }, index * 500);
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function copyRoomLink() {
    if (!currentRoomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('📋 链接已复制！发给朋友吧~', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('📋 链接已复制！', 'success');
    });
}

async function loadServerSurpriseList() {
    const container = document.getElementById('surpriseList');
    if (!container) return;
    try {
        const res = await fetch(`${API}/api/surprises`);
        const list = await res.json();
        if (!res.ok || list.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-emoji">🎉</div><p>还没有彩蛋记录</p><small>创建房间并设置生日彩蛋开奖后会显示在这里</small></div>`;
            return;
        }
        container.innerHTML = '';
        list.forEach(record => {
            const item = document.createElement('div');
            item.className = 'surprise-item';
            item.onclick = () => showServerSurpriseDetail(record.id);
            item.innerHTML = `<div class="surprise-item-title">🎬 ${record.scriptName}</div><div class="surprise-item-meta">🎂 ${record.birthdayPlayer} · ${record.time}</div>`;
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><div class="empty-emoji">⚠️</div><p>加载失败</p><small>请检查服务器连接</small></div>`;
    }
}

async function showServerSurpriseDetail(roomId) {
    try {
        const res = await fetch(`${API}/api/rooms/${roomId}/surprise`);
        const record = await res.json();
        if (!res.ok) { showToast(record.error || '加载失败', 'error'); return; }
        document.getElementById('surpriseScript').textContent = record.scriptName;
        document.getElementById('surprisePlayer').textContent = record.birthdayPlayer;
        document.getElementById('surpriseMessage').textContent = record.message || '（无）';
        document.getElementById('surpriseTime').textContent = record.time;
        if (record.task) { document.getElementById('surpriseTaskSection').style.display = 'block'; document.getElementById('surpriseTaskContent').textContent = record.task; }
        else { document.getElementById('surpriseTaskSection').style.display = 'none'; }
        document.getElementById('surpriseDetailCard').style.display = 'block';
        document.getElementById('surpriseDetailCard').scrollIntoView({ behavior: 'smooth' });
    } catch (e) { showToast('网络错误', 'error'); }
}

function saveSurpriseRecord() {
    // 兼容旧调用，彩蛋现在从服务端读取
    loadServerSurpriseList();
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    if (roomId) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
        document.querySelector('.nav-btn[data-module="join"]').classList.add('active');
        document.getElementById('module-join').classList.add('active');
        document.getElementById('joinRoomId').value = roomId;
        setTimeout(joinRoom, 500);
    }
}
