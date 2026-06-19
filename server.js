const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

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

function validateGenderMatch(room) {
    if (room.allowCrossPlay) return { valid: true };

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
            message: `性别匹配失败：需要 ${maleRoles} 个男角色但来了 ${malePlayers} 个男玩家，需要 ${femaleRoles} 个女角色但来了 ${femalePlayers} 个女玩家，"不限"角色仅 ${anyRoles} 个不足以补差。请开启反串或调整角色性别设置。`
        };
    }

    return { valid: true };
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
        score -= 100;
    }

    return score;
}

function isRoleAvoided(playerId, role, room) {
    if (!room.avoidRules || room.avoidRules.length === 0) return false;

    for (const rule of room.avoidRules) {
        if (rule.playerId === playerId) {
            if (rule.avoidTag === role.tag) return true;
            if (rule.avoidTag === '💕情侣' && role.tag === '💕情侣') return true;
        }
        if (rule.type === 'pair' && rule.playerIds && rule.playerIds.includes(playerId)) {
            if (rule.avoidTag === role.tag) return true;
        }
    }
    return false;
}

function assignRoles(room) {
    const players = room.players;
    const roles = room.roles;
    const results = {};

    const genderValidation = validateGenderMatch(room);
    if (!genderValidation.valid) {
        return { error: genderValidation.message };
    }

    const assignedRoles = new Set();

    const priorityOrder = [...players].sort((a, b) => {
        const aAvoid = (room.avoidRules || []).filter(r => r.playerId === a.id || (r.playerIds && r.playerIds.includes(a.id))).length;
        const bAvoid = (room.avoidRules || []).filter(r => r.playerId === b.id || (r.playerIds && r.playerIds.includes(b.id))).length;
        return bAvoid - aAvoid;
    });

    if (room.birthdayPlayerId) {
        const bpIndex = players.findIndex(p => p.id === room.birthdayPlayerId);
        if (bpIndex !== -1) {
            const bp = players[bpIndex];
            const idx = priorityOrder.findIndex(p => p.id === bp.id);
            if (idx !== -1) {
                priorityOrder.splice(idx, 1);
                priorityOrder.unshift(bp);
            }
        }
    }

    for (const player of priorityOrder) {
        const availableRoles = roles
            .map((role, index) => ({ role, index }))
            .filter(item => !assignedRoles.has(item.index));

        if (availableRoles.length === 0) break;

        let candidates = availableRoles.filter(item => !isRoleAvoided(player.id, item.role, room));

        if (candidates.length === 0) {
            candidates = availableRoles;
        }

        const scored = candidates.map(item => ({
            ...item,
            score: calculateMatchScore(player, item.role, room)
        }));

        scored.sort((a, b) => b.score - a.score);

        if (!room.allowCrossPlay) {
            const genderOk = scored.filter(s => {
                if (s.role.gender === 'any') return true;
                return s.role.gender === player.gender;
            });
            if (genderOk.length > 0) {
                const topGender = genderOk.slice(0, Math.min(2, genderOk.length));
                const selected = topGender[Math.floor(Math.random() * topGender.length)];
                results[player.id] = selected.role;
                assignedRoles.add(selected.index);
                continue;
            }
        }

        const topCandidates = scored.slice(0, Math.min(3, scored.length));
        const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];
        results[player.id] = selected.role;
        assignedRoles.add(selected.index);
    }

    return { results };
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
        players: [],
        status: 'waiting',
        createdAt: Date.now(),
        lotteryResults: null,
        creatorToken
    };

    res.json({ roomId, creatorToken, room: rooms[roomId] });
});

app.get('/api/rooms/:id', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) {
        return res.status(404).json({ error: '房间不存在' });
    }
    const safeRoom = { ...room };
    delete safeRoom.creatorToken;
    if (safeRoom.lotteryResults) {
        const safeResults = {};
        for (const [pid, role] of Object.entries(safeRoom.lotteryResults)) {
            safeResults[pid] = role;
        }
        safeRoom.lotteryResults = safeResults;
    }
    res.json(safeRoom);
});

app.post('/api/rooms/:id/join', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) {
        return res.status(404).json({ error: '房间不存在' });
    }
    if (room.status !== 'waiting') {
        return res.status(400).json({ error: '房间已开始抽签' });
    }
    if (room.players.length >= room.playerCount) {
        return res.status(400).json({ error: '房间人数已满' });
    }

    const { nickname, preference, gender } = req.body;
    if (!nickname || !nickname.trim()) {
        return res.status(400).json({ error: '请输入昵称' });
    }

    const playerId = generatePlayerId();
    const player = {
        id: playerId,
        nickname: nickname.trim(),
        preference: preference || 'any',
        gender: gender || 'male',
        joinedAt: Date.now()
    };

    room.players.push(player);

    const safeRoom = { ...room };
    delete safeRoom.creatorToken;

    res.json({ playerId, player, room: safeRoom });
});

app.post('/api/rooms/:id/birthday', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) {
        return res.status(404).json({ error: '房间不存在' });
    }

    const { playerId, creatorToken } = req.body;
    if (creatorToken !== room.creatorToken) {
        return res.status(403).json({ error: '只有发起人可以设置' });
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player && playerId !== null) {
        return res.status(400).json({ error: '玩家不存在' });
    }

    room.birthdayPlayerId = playerId || null;

    const safeRoom = { ...room };
    delete safeRoom.creatorToken;
    res.json({ success: true, room: safeRoom });
});

app.post('/api/rooms/:id/avoid', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) {
        return res.status(404).json({ error: '房间不存在' });
    }

    const { creatorToken, rules } = req.body;
    if (creatorToken !== room.creatorToken) {
        return res.status(403).json({ error: '只有发起人可以设置' });
    }

    room.avoidRules = rules || [];

    const safeRoom = { ...room };
    delete safeRoom.creatorToken;
    res.json({ success: true, room: safeRoom });
});

app.post('/api/rooms/:id/lottery', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) {
        return res.status(404).json({ error: '房间不存在' });
    }

    const { creatorToken } = req.body;
    if (creatorToken !== room.creatorToken) {
        return res.status(403).json({ error: '只有发起人可以开始抽签' });
    }

    if (room.players.length < room.playerCount) {
        return res.status(400).json({ error: `还差 ${room.playerCount - room.players.length} 位玩家` });
    }

    const genderValidation = validateGenderMatch(room);
    if (!genderValidation.valid) {
        return res.status(400).json({ error: genderValidation.message });
    }

    const assignResult = assignRoles(room);
    if (assignResult.error) {
        return res.status(400).json({ error: assignResult.error });
    }

    room.lotteryResults = assignResult.results;
    room.status = 'lottery-done';

    const safeRoom = { ...room };
    delete safeRoom.creatorToken;
    res.json({ success: true, room: safeRoom });
});

app.get('/api/rooms/:id/result/:playerId', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) {
        return res.status(404).json({ error: '房间不存在' });
    }
    if (!room.lotteryResults) {
        return res.status(400).json({ error: '抽签尚未完成' });
    }

    const role = room.lotteryResults[req.params.playerId];
    if (!role) {
        return res.status(404).json({ error: '未找到你的抽签结果' });
    }

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
    if (!room) {
        return res.status(404).json({ error: '房间不存在' });
    }
    res.json({
        players: room.players,
        birthdayPlayerId: room.birthdayPlayerId,
        avoidRules: room.avoidRules,
        status: room.status
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎂 生日剧本杀服务器运行在 http://localhost:${PORT}`);
});
