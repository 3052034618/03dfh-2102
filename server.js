const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 9527;
const DATA_FILE = path.join(__dirname, 'rooms-data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const rooms = {};

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

const avatarEmojis = ['🎭', '👑', '🎨', '🎪', '🎯', '🎸', '📚', '💎', '🌹', '🦋', '🐱', '🐶', '🦊', '🐰', '🐻'];

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf-8');
            const data = JSON.parse(raw);
            for (const [id, room] of Object.entries(data)) {
                rooms[id] = room;
            }
            console.log(`📂 已加载 ${Object.keys(data).length} 个房间数据`);
        }
    } catch (e) {
        console.log('📂 无历史房间数据，从空开始');
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2), 'utf-8');
    } catch (e) {
        console.error('保存数据失败:', e.message);
    }
}

function generateRoomId() {
    let id;
    do {
        id = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[id]);
    return id;
}

function generatePlayerId() {
    return 'p_' + Math.random().toString(36).substring(2, 10);
}

function canAssign(player, role, room) {
    if (!room.allowCrossPlay) {
        if (role.gender !== 'any' && role.gender !== player.gender) {
            return { ok: false, reason: 'gender' };
        }
    }
    const rules = room.avoidRules || [];
    for (const rule of rules) {
        if (rule.playerId !== player.id) continue;
        if (rule.type === 'tag' && rule.avoidTag === role.tag) {
            return { ok: false, reason: 'avoidTag', rule };
        }
        if (rule.type === 'role' && rule.avoidRoleId === role.id) {
            return { ok: false, reason: 'avoidRole', rule };
        }
    }
    return { ok: true };
}

function getAvailableRolesForPlayer(player, room, usedRoleIds) {
    return room.roles.filter(role => {
        if (usedRoleIds.has(role.id)) return false;
        return canAssign(player, role, room).ok;
    });
}

function findAllConflicts(room) {
    const conflicts = [];
    for (const player of room.players) {
        const available = getAvailableRolesForPlayer(player, room, new Set());
        if (available.length === 0) {
            const genderBlocked = !room.allowCrossPlay &&
                room.roles.every(r => r.gender !== 'any' && r.gender !== player.gender);

            const avoidBlockedReasons = [];
            const rules = room.avoidRules || [];
            for (const rule of rules) {
                if (rule.playerId !== player.id) continue;
                if (rule.type === 'tag') {
                    const matchingRoles = room.roles.filter(r => r.tag === rule.avoidTag);
                    avoidBlockedReasons.push({
                        type: 'tag',
                        tag: rule.avoidTag,
                        count: matchingRoles.length,
                        roleNames: matchingRoles.map(r => r.name)
                    });
                }
                if (rule.type === 'role') {
                    const role = room.roles.find(r => r.id === rule.avoidRoleId);
                    if (role) {
                        avoidBlockedReasons.push({
                            type: 'role',
                            roleName: role.name
                        });
                    }
                }
            }

            conflicts.push({
                player,
                genderBlocked,
                avoidBlockedReasons
            });
        }
    }
    return conflicts;
}

function backtrackAssign(players, roles, room, usedRoleIds) {
    const playersWithOptions = players.map(p => ({
        player: p,
        options: getAvailableRolesForPlayer(p, room, usedRoleIds)
    }));

    playersWithOptions.sort((a, b) => a.options.length - b.options.length);
    const orderedPlayers = playersWithOptions.map(x => x.player);

    const assignment = {};

    function backtrack(playerIndex) {
        if (playerIndex >= orderedPlayers.length) return true;

        const player = orderedPlayers[playerIndex];
        const available = getAvailableRolesForPlayer(player, room, usedRoleIds);
        if (available.length === 0) return false;

        const scored = available.map(role => {
            let score = 0;
            if (player.preference === 'high-energy' && role.tag === '🔥高能') score += 10;
            if (player.preference === 'funny' && role.tag === '😂搞笑') score += 10;
            if (player.preference === 'detective' && role.tag === '🔍推理') score += 10;
            if (player.preference === 'edge' && role.tag === '😌边缘') score += 10;
            if (player.preference === 'emotional' && role.tag === '💧情感') score += 10;
            if (!room.allowCrossPlay) {
                if (role.gender === player.gender) score += 5;
                else if (role.gender === 'any') score += 2;
            }
            score += Math.random() * 2;
            return { role, score };
        });

        scored.sort((a, b) => b.score - a.score);

        for (const { role } of scored) {
            usedRoleIds.add(role.id);
            assignment[player.id] = role;
            if (backtrack(playerIndex + 1)) return true;
            usedRoleIds.delete(role.id);
            delete assignment[player.id];
        }
        return false;
    }

    const success = backtrack(0);
    return success ? assignment : null;
}

function validateRoomForLottery(room) {
    if (room.roles.length !== room.players.length) {
        return {
            valid: false,
            error: `人数不匹配：设置了 ${room.playerCount} 位玩家，但有 ${room.roles.length} 个角色。${room.roles.length < room.playerCount ? '角色不够' : '角色太多'}，请调整角色数量。`
        };
    }

    if (room.players.length < room.playerCount) {
        return {
            valid: false,
            error: `还差 ${room.playerCount - room.players.length} 位玩家，人齐后才能开始抽签。`
        };
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
            return {
                valid: false,
                error: `性别匹配失败：有 ${malePlayers} 个男玩家但只有 ${maleRoles} 个男角色，有 ${femalePlayers} 个女玩家但只有 ${femaleRoles} 个女角色，"不限"角色仅 ${anyRoles} 个不足以补差。请开启反串或调整角色性别设置。`
            };
        }
    }

    const conflicts = findAllConflicts(room);
    if (conflicts.length > 0) {
        const parts = conflicts.map(c => {
            const reasons = [];
            if (c.genderBlocked) {
                reasons.push(`性别不匹配（关闭反串后无符合${c.player.gender === 'male' ? '男生' : '女生'}的角色）`);
            }
            if (c.avoidBlockedReasons && c.avoidBlockedReasons.length > 0) {
                c.avoidBlockedReasons.forEach(r => {
                    if (r.type === 'tag') {
                        reasons.push(`避开「${r.tag}」标签（涉及角色：${r.roleNames.join('、')}）`);
                    }
                    if (r.type === 'role') {
                        reasons.push(`避开角色「${r.roleName}」`);
                    }
                });
            }
            return `「${c.player.nickname}」${reasons.join('，')}`;
        });
        return {
            valid: false,
            error: `以下玩家没有可分配的角色：${parts.join('；')}。请调整避开规则或开启反串。`
        };
    }

    const assignment = backtrackAssign(room.players, room.roles, room, new Set());
    if (!assignment) {
        const details = [];
        const rules = room.avoidRules || [];
        const ruleMap = {};
        for (const rule of rules) {
            if (!ruleMap[rule.playerId]) ruleMap[rule.playerId] = [];
            const player = room.players.find(p => p.id === rule.playerId);
            if (rule.type === 'tag') {
                ruleMap[rule.playerId].push(`避开标签「${rule.avoidTag}」`);
            }
            if (rule.type === 'role') {
                const role = room.roles.find(r => r.id === rule.avoidRoleId);
                if (role) ruleMap[rule.playerId].push(`避开角色「${role.name}」`);
            }
        }
        for (const [pid, rls] of Object.entries(ruleMap)) {
            const player = room.players.find(p => p.id === pid);
            if (player) details.push(`「${player.nickname}」${rls.join('、')}`);
        }
        const detailStr = details.length > 0
            ? `涉及规则：${details.join('；')}。`
            : '';
        return {
            valid: false,
            error: `角色分配无解：${detailStr}综合性别和避开规则后无法为每个人分配到符合条件的角色。请减少避开规则或开启反串。`
        };
    }

    return { valid: true, assignment };
}

function assignRoles(room) {
    const result = validateRoomForLottery(room);
    if (!result.valid) return { error: result.error };
    return { results: result.assignment };
}

function getSafeRoom(room) {
    const safe = { ...room };
    delete safe.creatorToken;
    return safe;
}

app.post('/api/rooms', (req, res) => {
    const { scriptName, playerCount, allowCrossPlay, roles, birthdayMessage, openingSlogan, surpriseTask } = req.body;
    if (!scriptName || !playerCount || !roles || roles.length === 0) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    const roomId = generateRoomId();
    const creatorToken = 'ct_' + Math.random().toString(36).substring(2, 15);

    const processedRoles = roles.map((role, index) => ({
        id: index,
        name: role.name || `角色${index + 1}`,
        gender: role.gender || 'any',
        tag: role.tag || '🎭任意',
        costume: costumeHints[Math.floor(Math.random() * costumeHints.length)],
        line: entryLines[Math.floor(Math.random() * entryLines.length)],
        avatar: avatarEmojis[index % avatarEmojis.length]
    }));

    rooms[roomId] = {
        id: roomId,
        scriptName,
        playerCount,
        allowCrossPlay: allowCrossPlay !== false,
        roles: processedRoles,
        birthdayMessage: birthdayMessage || '',
        openingSlogan: openingSlogan || '',
        surpriseTask: surpriseTask || '',
        birthdayPlayerId: null,
        avoidRules: [],
        lockedPlayers: [],
        players: [],
        status: 'waiting',
        createdAt: Date.now(),
        lotteryResults: null,
        creatorToken
    };

    saveData();
    res.json({ roomId, creatorToken, room: getSafeRoom(rooms[roomId]) });
});

app.get('/api/rooms/:id', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });
    res.json(getSafeRoom(room));
});

app.post('/api/rooms/:id/join', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });
    if (room.status === 'finished') return res.status(400).json({ error: '房间已结束，请在查看结果处查看' });
    if (room.status !== 'waiting') return res.status(400).json({ error: '房间已开始抽签' });
    if (room.players.length >= room.playerCount) return res.status(400).json({ error: '房间人数已满' });

    const { nickname, preference, gender } = req.body;
    if (!nickname || !nickname.trim()) return res.status(400).json({ error: '请输入昵称' });

    const playerId = generatePlayerId();
    const player = {
        id: playerId,
        nickname: nickname.trim(),
        preference: preference || 'any',
        gender: gender || 'male',
        joinedAt: Date.now()
    };

    room.players.push(player);
    saveData();

    res.json({ playerId, player, room: getSafeRoom(room) });
});

app.post('/api/rooms/:id/birthday', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });

    const { playerId, creatorToken } = req.body;
    if (creatorToken !== room.creatorToken) return res.status(403).json({ error: '只有发起人可以设置' });
    if (playerId !== null && !room.players.find(p => p.id === playerId)) {
        return res.status(400).json({ error: '玩家不存在' });
    }

    room.birthdayPlayerId = playerId || null;
    saveData();

    res.json({ success: true, room: getSafeRoom(room) });
});

app.post('/api/rooms/:id/avoid', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });

    const { creatorToken, rules } = req.body;
    if (creatorToken !== room.creatorToken) return res.status(403).json({ error: '只有发起人可以设置' });

    room.avoidRules = rules || [];
    saveData();

    res.json({ success: true, room: getSafeRoom(room) });
});

app.post('/api/rooms/:id/lottery', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });

    const { creatorToken } = req.body;
    if (creatorToken !== room.creatorToken) return res.status(403).json({ error: '只有发起人可以开始抽签' });
    if (room.players.length < room.playerCount) {
        return res.status(400).json({ error: `还差 ${room.playerCount - room.players.length} 位玩家` });
    }

    const assignResult = assignRoles(room);
    if (assignResult.error) return res.status(400).json({ error: assignResult.error });

    room.lotteryResults = assignResult.results;
    room.status = 'lottery-done';
    room.lockedPlayers = [];
    saveData();

    res.json({ success: true, room: getSafeRoom(room) });
});

app.post('/api/rooms/:id/lock', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });

    const { creatorToken, lockedPlayerIds } = req.body;
    if (creatorToken !== room.creatorToken) return res.status(403).json({ error: '只有发起人可以设置' });
    if (room.status !== 'lottery-done') return res.status(400).json({ error: '尚未开奖，无法锁定' });

    room.lockedPlayers = lockedPlayerIds || [];
    saveData();

    res.json({ success: true, room: getSafeRoom(room) });
});

app.post('/api/rooms/:id/redo-lottery', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });

    const { creatorToken } = req.body;
    if (creatorToken !== room.creatorToken) return res.status(403).json({ error: '只有发起人可以重抽' });
    if (room.status !== 'lottery-done') return res.status(400).json({ error: '尚未开奖，无法重抽' });
    if (!room.lotteryResults) return res.status(400).json({ error: '没有开奖结果' });

    const locked = new Set(room.lockedPlayers || []);
    const playersToRedraw = room.players.filter(p => !locked.has(p.id));
    const usedRoleIds = new Set();

    for (const pid of locked) {
        const role = room.lotteryResults[pid];
        if (role) usedRoleIds.add(role.id);
    }

    if (playersToRedraw.length === 0) {
        return res.status(400).json({ error: '没有需要重抽的玩家，请先取消一些锁定' });
    }

    const virtualRoom = {
        ...room,
        players: playersToRedraw,
        roles: room.roles
    };

    const assignment = backtrackAssign(virtualRoom.players, virtualRoom.roles, virtualRoom, usedRoleIds);
    if (!assignment) {
        const conflicts = findAllConflicts(virtualRoom);
        if (conflicts.length > 0) {
            const parts = conflicts.map(c => {
                const reasons = [];
                if (c.genderBlocked) reasons.push(`性别不匹配`);
                if (c.avoidBlockedReasons && c.avoidBlockedReasons.length > 0) {
                    c.avoidBlockedReasons.forEach(r => {
                        if (r.type === 'tag') reasons.push(`避开「${r.tag}」标签`);
                        if (r.type === 'role') reasons.push(`避开角色「${r.roleName}」`);
                    });
                }
                return `「${c.player.nickname}」${reasons.join('，')}`;
            });
            return res.status(400).json({ error: `重抽失败，以下玩家无法分配：${parts.join('；')}。请调整避开规则或锁定设置。` });
        }
        return res.status(400).json({ error: '重抽失败：剩余角色和玩家无法匹配。请调整锁定设置或避开规则。' });
    }

    const newResults = { ...room.lotteryResults };
    for (const [pid, role] of Object.entries(assignment)) {
        newResults[pid] = role;
    }
    room.lotteryResults = newResults;
    room.lockedPlayers = [];
    room.redoCount = (room.redoCount || 0) + 1;
    saveData();

    res.json({ success: true, room: getSafeRoom(room) });
});

app.get('/api/rooms/:id/result/:playerId', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });
    if (!room.lotteryResults) return res.status(400).json({ error: '抽签尚未完成' });

    const role = room.lotteryResults[req.params.playerId];
    if (!role) return res.status(404).json({ error: '未找到你的抽签结果' });

    const isBirthday = room.birthdayPlayerId === req.params.playerId;

    res.json({
        role,
        isBirthday,
        birthdayMessage: isBirthday ? room.birthdayMessage : '',
        openingSlogan: isBirthday ? room.openingSlogan : '',
        surpriseTask: isBirthday ? room.surpriseTask : '',
        scriptName: room.scriptName
    });
});

app.get('/api/rooms/:id/players', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });
    res.json({
        players: room.players,
        birthdayPlayerId: room.birthdayPlayerId,
        avoidRules: room.avoidRules,
        lockedPlayers: room.lockedPlayers || [],
        status: room.status
    });
});

app.get('/api/surprises', (req, res) => {
    const list = [];
    for (const room of Object.values(rooms)) {
        if (room.birthdayPlayerId && (room.status === 'lottery-done' || room.status === 'finished')) {
            const bp = room.players.find(p => p.id === room.birthdayPlayerId);
            list.push({
                id: room.id,
                scriptName: room.scriptName,
                birthdayPlayer: bp ? bp.nickname : '未知',
                message: room.birthdayMessage || '',
                slogan: room.openingSlogan || '',
                task: room.surpriseTask || '',
                time: new Date(room.createdAt || Date.now()).toLocaleString('zh-CN')
            });
        }
    }
    list.sort((a, b) => b.id.localeCompare(a.id));
    res.json(list);
});

app.get('/api/rooms/:id/surprise', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });
    if (!room.birthdayPlayerId) return res.status(404).json({ error: '该房间未设置生日彩蛋' });
    const bp = room.players.find(p => p.id === room.birthdayPlayerId);
    res.json({
        id: room.id,
        scriptName: room.scriptName,
        birthdayPlayer: bp ? bp.nickname : '未知',
        message: room.birthdayMessage || '',
        slogan: room.openingSlogan || '',
        task: room.surpriseTask || '',
        time: new Date(room.createdAt || Date.now()).toLocaleString('zh-CN'),
        status: room.status
    });
});

app.post('/api/rooms/:id/finish', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });
    const { creatorToken } = req.body;
    if (creatorToken !== room.creatorToken) return res.status(403).json({ error: '只有发起人可以结束房间' });
    if (room.status !== 'lottery-done') return res.status(400).json({ error: '只有开奖后才能结束房间' });

    room.status = 'finished';
    room.finishedAt = Date.now();
    saveData();
    res.json({ success: true, room: getSafeRoom(room) });
});

app.get('/api/rooms/:id/export', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: '房间不存在' });
    if (!room.lotteryResults) return res.status(400).json({ error: '尚未开奖' });

    const lines = [];
    lines.push(`🎭 《${room.scriptName}》角色分配结果`);
    lines.push(`📅 ${new Date(room.finishedAt || room.createdAt || Date.now()).toLocaleString('zh-CN')}`);
    lines.push('');

    const bp = room.players.find(p => p.id === room.birthdayPlayerId);
    if (bp) {
        lines.push(`🎂 寿星：${bp.nickname}`);
        if (room.birthdayMessage) lines.push(`💌 祝福语：${room.birthdayMessage}`);
        if (room.openingSlogan) lines.push(`📢 开场口号：${room.openingSlogan}`);
        lines.push('');
    }

    for (const player of room.players) {
        const role = room.lotteryResults[player.id];
        if (!role) continue;
        const isBp = player.id === room.birthdayPlayerId ? ' 🎂' : '';
        const gender = player.gender === 'male' ? '♂' : '♀';
        lines.push(`  ${gender} ${player.nickname}${isBp}  →  ${role.name} ${role.tag}`);
    }

    lines.push('');
    lines.push('—— 生日快乐，玩得开心！🎉 ——');

    res.json({ text: lines.join('\n') });
});

loadData();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎂 生日剧本杀服务器运行在 http://localhost:${PORT}`);
});
