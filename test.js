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
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });
        req.on('error', reject);
        req.write(json);
        req.end();
    });
}

function get(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${PORT}${path}`, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body.substring(0, 200) });
                }
            });
        }).on('error', reject);
    });
}

async function test() {
    console.log('=== 测试1：创建房间 ===');
    const createRes = await post('/api/rooms', {
        scriptName: '测试剧本',
        playerCount: 3,
        allowCrossPlay: false,
        roles: [
            { name: '大太太', gender: 'female', tag: '🔥高能' },
            { name: '二少爷', gender: 'male', tag: '🔍推理' },
            { name: '管家', gender: 'any', tag: '😂搞笑' }
        ],
        birthdayMessage: '生日快乐~'
    });
    console.log('状态:', createRes.status);
    console.log('返回:', JSON.stringify(createRes.data, null, 2));

    if (createRes.status !== 200) return;

    const roomId = createRes.data.roomId;
    const creatorToken = createRes.data.creatorToken;

    console.log('\n=== 测试2：加入玩家1（男） ===');
    const join1 = await post(`/api/rooms/${roomId}/join`, {
        nickname: '小明', preference: 'high-energy', gender: 'male'
    });
    console.log('状态:', join1.status, '玩家:', join1.data.player ? join1.data.player.nickname : '失败');

    console.log('\n=== 测试3：加入玩家2（女） ===');
    const join2 = await post(`/api/rooms/${roomId}/join`, {
        nickname: '小红', preference: 'funny', gender: 'female'
    });
    console.log('状态:', join2.status, '玩家:', join2.data.player ? join2.data.player.nickname : '失败');

    console.log('\n=== 测试4：加入玩家3（男）- 测试性别冲突 ===');
    const join3 = await post(`/api/rooms/${roomId}/join`, {
        nickname: '小刚', preference: 'detective', gender: 'male'
    });
    console.log('状态:', join3.status, '玩家:', join3.data.player ? join3.data.player.nickname : '失败');

    console.log('\n=== 测试5：开始抽签（性别不匹配） ===');
    const lottery1 = await post(`/api/rooms/${roomId}/lottery`, { creatorToken });
    console.log('状态:', lottery1.status);
    console.log('错误:', lottery1.data.error || '无错误');

    console.log('\n=== 测试6：设置寿星 ===');
    const player1Id = join1.data.playerId;
    const birthdayRes = await post(`/api/rooms/${roomId}/birthday`, {
        playerId: player1Id, creatorToken
    });
    console.log('状态:', birthdayRes.status);

    console.log('\n=== 测试7：设置避开规则（小明避开管家这个具体角色） ===');
    const player2Id = join2.data.playerId;
    const avoidRes = await post(`/api/rooms/${roomId}/avoid`, {
        creatorToken,
        rules: [
            { type: 'role', playerId: player1Id, avoidRoleId: 2 }
        ]
    });
    console.log('状态:', avoidRes.status);

    console.log('\n=== 测试8：再试抽签（有避开规则） ===');
    const lottery2 = await post(`/api/rooms/${roomId}/lottery`, { creatorToken });
    console.log('状态:', lottery2.status);
    if (lottery2.status === 200) {
        console.log('分配结果:');
        const results = lottery2.data.room.lotteryResults;
        for (const [pid, role] of Object.entries(results)) {
            const player = lottery2.data.room.players.find(p => p.id === pid);
            console.log(`  ${player ? player.nickname : pid} → ${role.name} (${role.tag})`);
        }
    } else {
        console.log('错误:', lottery2.data.error);
    }
}

test().catch(console.error);
