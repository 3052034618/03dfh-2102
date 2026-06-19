let currentRoom = null;
let currentPlayer = null;
let pollingInterval = null;

const roleTags = ['🔥高能', '😂搞笑', '🔍推理', '😌边缘', '💧情感', '💕情侣', '🎭任意'];
const genderOptions = [
    { value: 'any', label: '不限' },
    { value: 'male', label: '♂男' },
    { value: 'female', label: '♀女' }
];

const costumeHints = [
    '建议穿着复古风服装，搭配精致配饰',
    '可以尝试深色系穿搭，营造神秘氛围',
    '休闲风即可，舒适最重要',
    '建议穿正装，显得气质出众',
    '可以穿得活泼鲜艳一些',
    '简约风格就好，不要太花哨',
    '建议穿国风元素的衣服',
    '可以尝试暗黑系风格',
    '甜美可爱风格最适合',
    '酷炫机车风了解一下'
];

const entryLines = [
    '"各位好，我是这个故事的见证者。"',
    '"来了？坐，好戏才刚刚开始。"',
    '"别来无恙啊，各位。"',
    '"今天，我们每个人都有秘密。"',
    '"我知道你们都在想什么..."',
    '"真相，往往藏在最不起眼的地方。"',
    '"让我们开始吧，时间不多了。"',
    '"诸位，请允许我自我介绍一下。"',
    '"命运的齿轮，已经开始转动。"',
    '"你们可以叫我...一个过客。"'
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

const avatarEmojis = ['🎭', '👑', '🎨', '🎪', '🎯', '🎸', '📚', '💎', '🌹', '🦋', '🐱', '🐶', '🦊', '🐰', '🐻'];

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
    const playerCountSelect = document.getElementById('playerCount');
    playerCountSelect.addEventListener('change', initDefaultRoles);
}

function initDefaultRoles() {
    const count = parseInt(document.getElementById('playerCount').value);
    const container = document.getElementById('rolesContainer');
    container.innerHTML = '';
    
    const defaultNames = [
        '大太太', '二少爷', '三小姐', '管家', '司机', '厨子',
        '律师', '医生', '记者', '侦探'
    ];
    
    for (let i = 0; i < count; i++) {
        addRoleRow(defaultNames[i] || `角色${i + 1}`);
    }
    
    updateBirthdayPlayerSelect();
}

function addRoleRow(defaultName = '') {
    const container = document.getElementById('rolesContainer');
    const row = document.createElement('div');
    row.className = 'role-row';
    
    const tagOptions = roleTags.map(tag => 
        `<option value="${tag}">${tag}</option>`
    ).join('');
    
    const genderOptionsHtml = genderOptions.map(opt =>
        `<option value="${opt.value}">${opt.label}</option>`
    ).join('');
    
    row.innerHTML = `
        <input type="text" placeholder="角色名" value="${defaultName}" maxlength="15">
        <select class="gender-select">
            ${genderOptionsHtml}
        </select>
        <select class="tag-select">
            ${tagOptions}
        </select>
        <button class="remove-btn" onclick="removeRoleRow(this)">×</button>
    `;
    
    container.appendChild(row);
    updateBirthdayPlayerSelect();
}

function removeRoleRow(btn) {
    const container = document.getElementById('rolesContainer');
    if (container.children.length > 4) {
        btn.parentElement.remove();
        updateBirthdayPlayerSelect();
    } else {
        showToast('至少需要4个角色哦~', 'error');
    }
}

function updateBirthdayPlayerSelect() {
    const select = document.getElementById('birthdayPlayer');
    const roleRows = document.querySelectorAll('#rolesContainer .role-row input');
    
    let currentValue = select.value;
    
    select.innerHTML = '<option value="none">-- 先不指定 --</option>';
    
    roleRows.forEach((input, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `寿星：${input.value || `角色${index + 1}`}`;
        select.appendChild(option);
    });
    
    if (currentValue && currentValue !== 'none') {
        select.value = currentValue;
    }
}

function addAvoidRule() {
    const container = document.getElementById('avoidRules');
    const row = document.createElement('div');
    row.className = 'avoid-rule-row';
    
    row.innerHTML = `
        <select class="avoid-player">
            <option value="">选择玩家</option>
        </select>
        <span style="color: var(--text-light);">不要和</span>
        <select class="avoid-player">
            <option value="">选择玩家</option>
        </select>
        <select class="avoid-tag">
            <option value="any">抽到同一类型角色</option>
            <option value="💕情侣">抽到情侣角色</option>
            <option value="🔥高能">都抽到高能位</option>
        </select>
        <button class="remove-btn" onclick="removeAvoidRule(this)">×</button>
    `;
    
    container.appendChild(row);
    updateAvoidPlayerSelects();
}

function removeAvoidRule(btn) {
    btn.parentElement.remove();
}

function updateAvoidPlayerSelects() {
    const roleRows = document.querySelectorAll('#rolesContainer .role-row input');
    const roleNames = Array.from(roleRows).map((input, i) => input.value || `角色${i + 1}`);
    
    const selects = document.querySelectorAll('.avoid-player');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">选择玩家</option>';
        roleNames.forEach((name, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = name;
            select.appendChild(option);
        });
        if (currentValue) select.value = currentValue;
    });
}

function createRoom() {
    const scriptName = document.getElementById('scriptName').value.trim();
    if (!scriptName) {
        showToast('请输入剧本名称~', 'error');
        return;
    }
    
    const playerCount = parseInt(document.getElementById('playerCount').value);
    const allowCrossPlay = document.getElementById('allowCrossPlay').checked;
    const birthdayPlayerIndex = document.getElementById('birthdayPlayer').value;
    const birthdayMessage = document.getElementById('birthdayMessage').value.trim();
    const openingSlogan = document.getElementById('openingSlogan').value.trim();
    const surpriseTask = document.getElementById('surpriseTask').value.trim();
    
    const roles = [];
    const roleRows = document.querySelectorAll('#rolesContainer .role-row');
    let hasEmptyRole = false;
    
    roleRows.forEach((row, index) => {
        const nameInput = row.querySelector('input');
        const genderSelect = row.querySelector('.gender-select');
        const tagSelect = row.querySelector('.tag-select');
        
        const name = nameInput.value.trim();
        if (!name) hasEmptyRole = true;
        
        roles.push({
            id: index,
            name: name || `角色${index + 1}`,
            gender: genderSelect.value,
            tag: tagSelect.value,
            costume: costumeHints[Math.floor(Math.random() * costumeHints.length)],
            line: entryLines[Math.floor(Math.random() * entryLines.length)],
            avatar: avatarEmojis[index % avatarEmojis.length]
        });
    });
    
    if (hasEmptyRole) {
        showToast('有角色名字为空，已自动填充~', 'info');
    }
    
    const avoidRules = [];
    const avoidRows = document.querySelectorAll('#avoidRules .avoid-rule-row');
    avoidRows.forEach(row => {
        const selects = row.querySelectorAll('.avoid-player');
        const tagSelect = row.querySelector('.avoid-tag');
        const p1 = selects[0].value;
        const p2 = selects[1].value;
        const tag = tagSelect.value;
        
        if (p1 !== '' && p2 !== '' && p1 !== p2) {
            avoidRules.push({
                player1: parseInt(p1),
                player2: parseInt(p2),
                tag: tag
            });
        }
    });
    
    const roomId = generateRoomId();
    
    currentRoom = {
        id: roomId,
        scriptName,
        playerCount,
        allowCrossPlay,
        roles,
        avoidRules,
        birthdayPlayerIndex: birthdayPlayerIndex === 'none' ? -1 : parseInt(birthdayPlayerIndex),
        birthdayMessage,
        openingSlogan,
        surpriseTask,
        players: [],
        status: 'waiting',
        createdAt: Date.now(),
        lotteryResults: null
    };
    
    saveRoom(currentRoom);
    
    document.querySelector('#module-create .card').style.display = 'none';
    document.getElementById('roomCreatedCard').style.display = 'block';
    
    document.getElementById('roomId').textContent = roomId;
    document.getElementById('roomScriptName').textContent = scriptName;
    document.getElementById('roomPlayerCount').textContent = playerCount;
    
    generateQRCode(roomId);
    
    startPolling();
    updateJoinedPlayersList();
    
    if (birthdayMessage || openingSlogan || surpriseTask) {
        saveSurpriseRecord({
            scriptName,
            birthdayPlayer: birthdayPlayerIndex === 'none' ? '未指定' : roles[parseInt(birthdayPlayerIndex)].name,
            message: birthdayMessage,
            slogan: openingSlogan,
            task: surpriseTask,
            time: new Date().toLocaleString('zh-CN')
        });
    }
    
    showToast('🎉 房间创建成功！', 'success');
    triggerConfetti();
}

function generateRoomId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateQRCode(roomId) {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = '';
    
    if (window.QRCode) {
        new QRCode(qrcodeContainer, {
            text: url,
            width: 150,
            height: 150,
            colorDark: '#2d3436',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        qrcodeContainer.innerHTML = `
            <div style="padding: 20px; color: var(--text-light);">
                <p>房间链接：</p>
                <p style="font-size: 12px; word-break: break-all;">${url}</p>
            </div>
        `;
    }
}

function saveRoom(room) {
    const rooms = JSON.parse(localStorage.getItem('birthdayMurderRooms') || '{}');
    rooms[room.id] = room;
    localStorage.setItem('birthdayMurderRooms', JSON.stringify(rooms));
}

function getRoom(roomId) {
    const rooms = JSON.parse(localStorage.getItem('birthdayMurderRooms') || '{}');
    return rooms[roomId] || null;
}

function updateJoinedPlayersList() {
    if (!currentRoom) return;
    
    const container = document.getElementById('joinedPlayersList');
    container.innerHTML = '';
    
    currentRoom.players.forEach((player, index) => {
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        
        const isBirthday = currentRoom.birthdayPlayerIndex !== -1 && index === currentRoom.birthdayPlayerIndex;
        if (isBirthday) {
            chip.classList.add('birthday');
            chip.innerHTML = `<span>🎂</span><span>${player.nickname}</span>`;
        } else {
            chip.innerHTML = `<span>👤</span><span>${player.nickname}</span>`;
        }
        
        container.appendChild(chip);
    });
    
    if (currentRoom.players.length === 0) {
        container.innerHTML = '<small style="color: var(--text-light);">等待玩家加入...</small>';
    }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(() => {
        if (!currentRoom) return;
        
        const freshRoom = getRoom(currentRoom.id);
        if (freshRoom) {
            currentRoom = freshRoom;
            
            updateJoinedPlayersList();
            
            if (currentRoom.status === 'lottery-done') {
                if (currentPlayer) {
                    showLotteryResult();
                }
                clearInterval(pollingInterval);
            }
        }
    }, 1000);
}

function startLottery() {
    if (!currentRoom) return;
    
    if (currentRoom.players.length < currentRoom.playerCount) {
        showToast(`还差 ${currentRoom.playerCount - currentRoom.players.length} 位玩家哦~`, 'error');
        return;
    }
    
    const results = assignRoles(currentRoom);
    currentRoom.lotteryResults = results;
    currentRoom.status = 'lottery-done';
    saveRoom(currentRoom);
    
    showToast('🎲 抽签开始！', 'success');
}

function assignRoles(room) {
    const players = [...room.players];
    const roles = [...room.roles];
    const results = {};
    
    const shuffledPlayers = players.map((p, i) => ({ ...p, originalIndex: i }));
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }
    
    const assignedRoles = new Set();
    
    if (room.birthdayPlayerIndex !== -1 && room.birthdayPlayerIndex < players.length) {
        const birthdayPlayer = players[room.birthdayPlayerIndex];
        let bestRole = null;
        let bestScore = -1;
        
        roles.forEach((role, roleIndex) => {
            if (assignedRoles.has(roleIndex)) return;
            const score = calculateMatchScore(birthdayPlayer, role, room);
            if (score > bestScore) {
                bestScore = score;
                bestRole = { role, roleIndex };
            }
        });
        
        if (bestRole) {
            results[room.birthdayPlayerIndex] = bestRole.role;
            assignedRoles.add(bestRole.roleIndex);
        }
    }
    
    shuffledPlayers.forEach(player => {
        if (results[player.originalIndex] !== undefined) return;
        
        const availableRoles = roles
            .map((role, index) => ({ role, index }))
            .filter(item => !assignedRoles.has(item.index));
        
        if (availableRoles.length === 0) return;
        
        const scoredRoles = availableRoles.map(item => ({
            ...item,
            score: calculateMatchScore(player, item.role, room)
        }));
        
        scoredRoles.sort((a, b) => b.score - a.score);
        
        const topCandidates = scoredRoles.slice(0, Math.min(3, scoredRoles.length));
        const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];
        
        results[player.originalIndex] = selected.role;
        assignedRoles.add(selected.index);
    });
    
    return results;
}

function calculateMatchScore(player, role, room) {
    let score = 0;
    
    if (player.preference === 'high-energy' && role.tag === '🔥高能') score += 10;
    if (player.preference === 'funny' && role.tag === '😂搞笑') score += 10;
    if (player.preference === 'detective' && role.tag === '🔍推理') score += 10;
    if (player.preference === 'edge' && role.tag === '😌边缘') score += 10;
    if (player.preference === 'emotional' && role.tag === '💧情感') score += 10;
    
    if (role.gender === 'any') {
        score += 3;
    } else if (role.gender === player.gender) {
        score += 5;
    } else if (!room.allowCrossPlay) {
        score -= 20;
    }
    
    score += Math.random() * 3;
    
    return score;
}

function joinRoom() {
    const roomId = document.getElementById('joinRoomId').value.trim();
    if (!roomId || roomId.length !== 6) {
        showToast('请输入6位房间号~', 'error');
        return;
    }
    
    const room = getRoom(roomId);
    if (!room) {
        showToast('房间不存在哦~', 'error');
        return;
    }
    
    if (room.status !== 'waiting') {
        showToast('房间已开始抽签啦~', 'error');
        return;
    }
    
    currentRoom = room;
    
    document.getElementById('joinRoomCard').style.display = 'none';
    document.getElementById('playerInfoCard').style.display = 'block';
    
    showToast('✅ 找到房间啦！', 'success');
}

function submitPlayerInfo() {
    const nickname = document.getElementById('playerNickname').value.trim();
    if (!nickname) {
        showToast('请输入你的昵称~', 'error');
        return;
    }
    
    const preference = document.querySelector('input[name="preference"]:checked').value;
    const gender = document.querySelector('input[name="gender"]:checked').value;
    
    if (currentRoom.players.length >= currentRoom.playerCount) {
        showToast('房间人数已满啦~', 'error');
        return;
    }
    
    currentPlayer = {
        id: currentRoom.players.length,
        nickname,
        preference,
        gender
    };
    
    currentRoom.players.push(currentPlayer);
    saveRoom(currentRoom);
    
    document.getElementById('playerInfoCard').style.display = 'none';
    document.getElementById('waitingCard').style.display = 'block';
    
    document.getElementById('waitingRoomName').textContent = currentRoom.scriptName;
    document.getElementById('waitingTotal').textContent = currentRoom.playerCount;
    
    startPolling();
    updateWaitingList();
    
    showToast('🎉 加入成功！等待抽签~', 'success');
}

function updateWaitingList() {
    if (!currentRoom) return;
    
    document.getElementById('waitingPlayerCount').textContent = currentRoom.players.length;
    
    const container = document.getElementById('waitingPlayersList');
    container.innerHTML = '';
    
    currentRoom.players.forEach((player, index) => {
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        
        const isBirthday = currentRoom.birthdayPlayerIndex !== -1 && index === currentRoom.birthdayPlayerIndex;
        const isCurrentPlayer = currentPlayer && currentPlayer.id === index;
        
        if (isBirthday) {
            chip.classList.add('birthday');
            chip.innerHTML = `<span>🎂</span><span>${player.nickname}</span>`;
        } else if (isCurrentPlayer) {
            chip.classList.add('ready');
            chip.innerHTML = `<span>✨</span><span>${player.nickname}（你）</span>`;
        } else {
            chip.innerHTML = `<span>👤</span><span>${player.nickname}</span>`;
        }
        
        container.appendChild(chip);
    });
}

function showLotteryResult() {
    if (!currentPlayer || !currentRoom || !currentRoom.lotteryResults) return;
    
    const result = currentRoom.lotteryResults[currentPlayer.id];
    if (!result) return;
    
    clearInterval(pollingInterval);
    
    const isBirthdayPlayer = currentRoom.birthdayPlayerIndex !== -1 && 
                            currentPlayer.id === currentRoom.birthdayPlayerIndex;
    
    if (isBirthdayPlayer) {
        document.getElementById('birthdayAnimation').style.display = 'block';
        triggerConfetti();
        triggerDanmaku();
        
        setTimeout(() => {
            document.getElementById('birthdayExtra').style.display = 'block';
            document.getElementById('birthdayMessageDisplay').textContent = 
                currentRoom.birthdayMessage || '生日快乐！愿你天天开心~';
            
            if (currentRoom.openingSlogan) {
                document.getElementById('openingSloganDisplay').style.display = 'block';
                document.getElementById('sloganText').textContent = currentRoom.openingSlogan;
                document.getElementById('sloganBtn').style.display = 'block';
            }
        }, 1500);
    } else {
        document.getElementById('birthdayAnimation').style.display = 'none';
        document.getElementById('birthdayExtra').style.display = 'none';
        document.getElementById('sloganBtn').style.display = 'none';
    }
    
    document.getElementById('waitingCard').style.display = 'none';
    document.getElementById('lotteryResultCard').style.display = 'block';
    
    document.getElementById('resultTitle').textContent = isBirthdayPlayer ? 
        '🎂 寿星专属角色是...' : '🎭 你的角色是...';
    
    document.getElementById('roleAvatar').textContent = result.avatar;
    document.getElementById('roleName').textContent = result.name;
    
    const tagsContainer = document.getElementById('roleTags');
    tagsContainer.innerHTML = '';
    const tagSpan = document.createElement('span');
    tagSpan.className = 'role-tag';
    tagSpan.textContent = result.tag;
    tagsContainer.appendChild(tagSpan);
    
    if (result.gender !== 'any') {
        const genderSpan = document.createElement('span');
        genderSpan.className = 'role-tag';
        genderSpan.textContent = result.gender === 'male' ? '♂男' : '♀女';
        tagsContainer.appendChild(genderSpan);
    }
    
    document.getElementById('roleCostume').textContent = result.costume;
    document.getElementById('roleLine').textContent = result.line;
}

function showSloganModal() {
    if (!currentRoom || !currentRoom.openingSlogan) return;
    
    document.getElementById('bigSloganText').textContent = currentRoom.openingSlogan;
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

function triggerDanmaku() {
    const container = document.getElementById('danmakuContainer');
    
    const messages = [...birthdayDanmakuMessages];
    if (currentRoom && currentRoom.birthdayMessage) {
        messages.unshift('💌 ' + currentRoom.birthdayMessage);
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
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

function copyRoomLink() {
    if (!currentRoom) return;
    
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoom.id}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('📋 链接已复制！', 'success');
    }).catch(() => {
        showToast('复制失败，请手动复制~', 'error');
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
        const room = getRoom(roomId);
        if (room && room.status === 'waiting') {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
            
            document.querySelector('.nav-btn[data-module="join"]').classList.add('active');
            document.getElementById('module-join').classList.add('active');
            
            document.getElementById('joinRoomId').value = roomId;
            setTimeout(joinRoom, 500);
        }
    }
}
