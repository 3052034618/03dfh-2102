const http = require('http');
const PORT = 9527;

function post(path, data) {
    return new Promise((resolve, reject) => {
        const json = JSON.stringify(data);
        const req = http.request({
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(json)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch (e) { resolve({ status: res.statusCode, data: body }); }
            });
        });
        req.on('error', reject);
        req.write(json);
        req.end();
    });
}

async function testConflict() {
    console.log('=== 场景1：角色数量与玩家数量不匹配 ===');
    const r1 = await post('/api/rooms', {
        scriptName: '测试1',
        playerCount: 4,
        allowCrossPlay: true,
        roles: [
            { name: '角色A', gender: 'any', tag: '🔥高能' },
            { name: '角色B', gender: 'any', tag: '😂搞笑' },
            { name: '角色C', gender: 'any', tag: '🔍推理' }
        ]
    });
    console.log('创建房间:', r1.status, '-', r1.data.error || '成功');

    const roomId = r1.data.roomId;
    const token = r1.data.creatorToken;

    await post(`/api/rooms/${roomId}/join`, { nickname: '玩家1', gender: 'male' });
    await post(`/api/rooms/${roomId}/join`, { nickname: '玩家2', gender: 'male' });
    await post(`/api/rooms/${roomId}/join`, { nickname: '玩家3', gender: 'female' });
    await post(`/api/rooms/${roomId}/join`, { nickname: '玩家4', gender: 'female' });

    const l1 = await post(`/api/rooms/${roomId}/lottery`, { creatorToken: token });
    console.log('开始抽签:', l1.status, '-', l1.data.error || '成功');

    console.log('\n=== 场景2：关闭反串，性别完全不匹配 ===');
    const r2 = await post('/api/rooms', {
        scriptName: '测试2',
        playerCount: 2,
        allowCrossPlay: false,
        roles: [
            { name: '大小姐', gender: 'female', tag: '🔥高能' },
            { name: '二小姐', gender: 'female', tag: '😂搞笑' }
        ]
    });
    const roomId2 = r2.data.roomId;
    const token2 = r2.data.creatorToken;

    await post(`/api/rooms/${roomId2}/join`, { nickname: '大明', gender: 'male' });
    await post(`/api/rooms/${roomId2}/join`, { nickname: '二明', gender: 'male' });

    const l2 = await post(`/api/rooms/${roomId2}/lottery`, { creatorToken: token2 });
    console.log('开始抽签:', l2.status);
    console.log('错误提示:', l2.data.error);

    console.log('\n=== 场景3：避开规则导致无解（小明避开所有角色） ===');
    const r3 = await post('/api/rooms', {
        scriptName: '测试3',
        playerCount: 2,
        allowCrossPlay: true,
        roles: [
            { name: '角色一', gender: 'any', tag: '🔥高能' },
            { name: '角色二', gender: 'any', tag: '😂搞笑' }
        ]
    });
    const roomId3 = r3.data.roomId;
    const token3 = r3.data.creatorToken;

    const j3a = await post(`/api/rooms/${roomId3}/join`, { nickname: '小明', gender: 'male' });
    await post(`/api/rooms/${roomId3}/join`, { nickname: '小红', gender: 'female' });

    await post(`/api/rooms/${roomId3}/avoid`, {
        creatorToken: token3,
        rules: [
            { type: 'tag', playerId: j3a.data.playerId, avoidTag: '🔥高能' },
            { type: 'tag', playerId: j3a.data.playerId, avoidTag: '😂搞笑' }
        ]
    });

    const l3 = await post(`/api/rooms/${roomId3}/lottery`, { creatorToken: token3 });
    console.log('开始抽签:', l3.status);
    console.log('错误提示:', l3.data.error);

    console.log('\n=== 场景4：避开具体角色（小明不能拿管家）===');
    const r4 = await post('/api/rooms', {
        scriptName: '测试4',
        playerCount: 3,
        allowCrossPlay: true,
        roles: [
            { name: '管家', gender: 'any', tag: '😌边缘' },
            { name: '少爷', gender: 'any', tag: '🔥高能' },
            { name: '小姐', gender: 'any', tag: '💧情感' }
        ]
    });
    const roomId4 = r4.data.roomId;
    const token4 = r4.data.creatorToken;

    const j4a = await post(`/api/rooms/${roomId4}/join`, { nickname: '小明', gender: 'male', preference: 'high-energy' });
    await post(`/api/rooms/${roomId4}/join`, { nickname: '小红', gender: 'female' });
    await post(`/api/rooms/${roomId4}/join`, { nickname: '小刚', gender: 'male' });

    await post(`/api/rooms/${roomId4}/avoid`, {
        creatorToken: token4,
        rules: [
            { type: 'role', playerId: j4a.data.playerId, avoidRoleId: 0 }
        ]
    });

    const l4 = await post(`/api/rooms/${roomId4}/lottery`, { creatorToken: token4 });
    console.log('开始抽签:', l4.status);
    if (l4.status === 200) {
        const results = l4.data.room.lotteryResults;
        const players = l4.data.room.players;
        console.log('分配结果:');
        for (const [pid, role] of Object.entries(results)) {
            const p = players.find(x => x.id === pid);
            console.log(`  ${p ? p.nickname : pid} → ${role.name} (${role.tag})`);
        }
        const ming = players.find(p => p.nickname === '小明');
        const mingRole = results[ming.id];
        console.log(`验证：小明拿到的是「${mingRole.name}」，${mingRole.name === '管家' ? '❌ 错误：拿到了避开的角色' : '✅ 正确：避开了管家'}`);
    } else {
        console.log('错误:', l4.data.error);
    }
}

testConflict().catch(console.error);
