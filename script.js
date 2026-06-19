const API = '';

let currentRoomId = null;
let creatorToken = null;
let currentPlayerId = null;
let creatorPollingInterval = null;
let playerPollingInterval = null;

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
    loadSurpriseList();
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
    if (!scriptName) {
        showToast('请输入剧本名称~', 'error');
        return;
    }

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
            body: JSON.stringify({
                scriptName, playerCount, allowCrossPlay, roles,
                birthdayMessage, openingSlogan, surpriseTask
            })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || '创建失败', 'error');
            return;
        }

        currentRoomId = data.roomId;
        creatorToken = data.creatorToken;

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
            saveSurpriseRecord({
                scriptName,
                birthdayPlayer: '待指定',
                message: birthdayMessage,
                slogan: openingSlogan,
                task: surpriseTask,
                time: new Date().toLocaleString('zh-CN')
            });
        }

        showToast('🎉 房间创建成功！', 'success');
        triggerConfetti();

    } catch (e) {
        showToast('网络错误，请检查服务器~', 'error');
        console.error(e);
    }
}

function generateQRCode(roomId) {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = '';

    if (window.QRCode) {
        new QRCode(qrcodeContainer, {
            text: url, width: 150, height: 150,
            colorDark: '#2d3436', colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
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
            updateCreatorPlayerList(room);
            checkRoomValidation(room);
            updateAllAvoidRoleOptions(room);
        } catch (e) { }
    }, 2000);
}

function updateAllAvoidRoleOptions(room) {
    const roleSelects = document.querySelectorAll('#creatorAvoidRules .avoid-rule-role');
    roleSelects.forEach(sel => updateAvoidRoleOptions(room, sel));
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, creatorToken })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || '设置失败', 'error');
            return;
        }
        showToast(playerId ? '🎂 已指定寿星！' : '已取消寿星指定', 'success');
        updateCreatorPlayerList(data.room);
    } catch (e) {
        showToast('网络错误', 'error');
    }
}

function updateAvoidRulePlayerOptions(room) {
    const selects = document.querySelectorAll('#creatorAvoidRules .avoid-rule-player');
    selects.forEach(select => {
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

function updateAvoidRoleOptions(room, selectEl) {
    const curVal = selectEl.value;
    selectEl.innerHTML = '<option value="">选择角色</option>';
    room.roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        select.appendChild(opt);
    });
    if (curVal !== undefined && curVal !== '') selectEl.value = curVal;
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
    });

    fetch(`${API}/api/rooms/${currentRoomId}`).then(r => r.json()).then(room => {
        updateAvoidRulePlayerOptions(room);
        updateAvoidRoleOptions(room, roleSelect);
    });
}

async function collectAndSaveAvoidRules() {
    const rules = [];
    const rows = document.querySelectorAll('#creatorAvoidRules .avoid-rule-item');
    rows.forEach(row => {
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

    try {
        await fetch(`${API}/api/rooms/${currentRoomId}/avoid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorToken, rules })
        });
    } catch (e) { }
}

function checkRoomValidation(room) {
    const btn = document.getElementById('startLotteryBtn');
    const warningBox = document.getElementById('genderValidationMsg');
    const warningText = document.getElementById('genderWarningText');

    if (room.players.length === 0) {
        warningBox.style.display = 'none';
        btn.disabled = true;
        btn.style.opacity = '0.5';
        return;
    }

    if (room.roles.length !== room.playerCount) {
        warningBox.style.display = 'block';
        warningText.innerHTML = `⚠️ 角色数量不匹配：设置了 ${room.playerCount} 位玩家，但有 ${room.roles.length} 个角色。${room.roles.length < room.playerCount ? '角色不够，请添加角色' : '角色太多，请删除角色'}。`;
        btn.disabled = true;
        btn.style.opacity = '0.5';
        return;
    }

    if (room.players.length < room.playerCount) {
        warningBox.style.display = 'none';
        btn.disabled = true;
        btn.style.opacity = '0.5';
        return;
    }

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
            warningText.innerHTML =
                `⚠️ 性别匹配失败：有 ${malePlayers} 个男玩家但只有 ${maleRoles} 个男角色，` +
                `有 ${femalePlayers} 个女玩家但只有 ${femaleRoles} 个女角色。"不限"角色仅 ${anyRoles} 个，不足以补差。` +
                `请开启反串或调整角色性别。`;
            btn.disabled = true;
            btn.style.opacity = '0.5';
            return;
        }
    }

    warningBox.style.display = 'none';
    btn.disabled = false;
    btn.style.opacity = '1';
}

async function startLottery() {
    await collectAndSaveAvoidRules();

    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/lottery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

    } catch (e) {
        showToast('网络错误', 'error');
    }
}

function showCreatorResults(room) {
    clearInterval(creatorPollingInterval);
    document.getElementById('roomManageCard').style.display = 'none';
    document.getElementById('lotteryDoneCard').style.display = 'block';

    const container = document.getElementById('creatorResultList');
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

function closeGenderErrorModal() {
    document.getElementById('genderErrorModal').style.display = 'none';
}

async function joinRoom() {
    const roomId = document.getElementById('joinRoomId').value.trim();
    if (!roomId || roomId.length !== 6) {
        showToast('请输入6位房间号~', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/api/rooms/${roomId}`);
        const room = await res.json();
        if (!res.ok) {
            showToast(room.error || '房间不存在', 'error');
            return;
        }
        if (room.status !== 'waiting') {
            showToast('房间已开始抽签啦~', 'error');
            return;
        }

        currentRoomId = roomId;
        document.getElementById('joinRoomCard').style.display = 'none';
        document.getElementById('playerInfoCard').style.display = 'block';
        document.getElementById('joinScriptName').textContent = room.scriptName;

        showToast('✅ 找到房间啦！', 'success');
    } catch (e) {
        showToast('网络错误，请检查连接~', 'error');
    }
}

async function submitPlayerInfo() {
    const nickname = document.getElementById('playerNickname').value.trim();
    if (!nickname) {
        showToast('请输入你的昵称~', 'error');
        return;
    }

    const preference = document.querySelector('input[name="preference"]:checked').value;
    const gender = document.querySelector('input[name="gender"]:checked').value;

    try {
        const res = await fetch(`${API}/api/rooms/${currentRoomId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, preference, gender })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || '加入失败', 'error');
            return;
        }

        currentPlayerId = data.playerId;
        currentRoomId = currentRoomId;

        document.getElementById('playerInfoCard').style.display = 'none';
        document.getElementById('waitingCard').style.display = 'block';
        document.getElementById('waitingRoomName').textContent = data.room.scriptName;
        document.getElementById('waitingTotal').textContent = data.room.playerCount;

        updateWaitingPlayerList(data.room);
        startPlayerPolling();

        showToast('🎉 加入成功！等待抽签~', 'success');
    } catch (e) {
        showToast('网络错误', 'error');
    }
}

function startPlayerPolling() {
    if (playerPollingInterval) clearInterval(playerPollingInterval);
    playerPollingInterval = setInterval(async () => {
        if (!currentRoomId || !currentPlayerId) return;
        try {
            const res = await fetch(`${API}/api/rooms/${currentRoomId}`);
            const room = await res.json();
            updateWaitingPlayerList(room);
            if (room.status === 'lottery-done') {
                clearInterval(playerPollingInterval);
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
        if (!res.ok) {
            showToast(data.error || '获取结果失败', 'error');
            return;
        }
        showLotteryResult(data);
    } catch (e) {
        showToast('网络错误', 'error');
    }
}

function showLotteryResult(data) {
    const { role, isBirthday, birthdayMessage, openingSlogan } = data;

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

        triggerConfetti();
        triggerDanmaku(birthdayMessage);
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
            if (shape === 'circle') {
                confetti.style.borderRadius = '50%';
            } else if (shape === 'triangle') {
                confetti.style.width = '0';
                confetti.style.height = '0';
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
    if (customMessage) {
        messages.unshift('💌 ' + customMessage);
    }

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

function saveSurpriseRecord(record) {
    const records = JSON.parse(localStorage.getItem('birthdaySurpriseRecords') || '[]');
    records.unshift(record);
    if (records.length > 10) records.pop();
    localStorage.setItem('birthdaySurpriseRecords', JSON.stringify(records));
    loadSurpriseList();
}

function loadSurpriseList() {
    const records = JSON.parse(localStorage.getItem('birthdaySurpriseRecords') || '[]');
    const container = document.getElementById('surpriseList');

    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-emoji">🎉</div>
                <p>还没有彩蛋记录</p>
                <small>创建房间并设置生日彩蛋后会显示在这里</small>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    records.forEach((record, index) => {
        const item = document.createElement('div');
        item.className = 'surprise-item';
        item.onclick = () => showSurpriseDetail(index);
        item.innerHTML = `
            <div class="surprise-item-title">🎬 ${record.scriptName}</div>
            <div class="surprise-item-meta">🎂 ${record.birthdayPlayer} · ${record.time}</div>
        `;
        container.appendChild(item);
    });
}

function showSurpriseDetail(index) {
    const records = JSON.parse(localStorage.getItem('birthdaySurpriseRecords') || '[]');
    const record = records[index];
    if (!record) return;

    document.getElementById('surpriseScript').textContent = record.scriptName;
    document.getElementById('surprisePlayer').textContent = record.birthdayPlayer;
    document.getElementById('surpriseMessage').textContent = record.message || '（无）';
    document.getElementById('surpriseTime').textContent = record.time;

    if (record.task) {
        document.getElementById('surpriseTaskSection').style.display = 'block';
        document.getElementById('surpriseTaskContent').textContent = record.task;
    } else {
        document.getElementById('surpriseTaskSection').style.display = 'none';
    }

    document.getElementById('surpriseDetailCard').style.display = 'block';
    document.getElementById('surpriseDetailCard').scrollIntoView({ behavior: 'smooth' });
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
