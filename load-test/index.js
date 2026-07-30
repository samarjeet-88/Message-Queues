const URL = 'http://localhost:3000/redis/notification';
const CONCURRENT_USERS = 1000;

async function sendRequest(id) {
    const start = Date.now();
    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: `Load test message from user ${id}` }),
        });
        const duration = Date.now() - start;
        if (response.ok) {
            console.log(`[User ${id}] Success: ${response.status} (${duration}ms)`);
        } else {
            console.error(`[User ${id}] Failed: ${response.status} (${duration}ms)`);
        }
    } catch (error) {
        const duration = Date.now() - start;
        console.error(`[User ${id}] Error: ${error.message} (${duration}ms)`);
    }
}

async function runLoadTest() {
    console.log(`Starting load test with ${CONCURRENT_USERS} concurrent requests...`);
    const startTime = Date.now();

    // Spawn 50 requests concurrently
    const promises = Array.from({ length: CONCURRENT_USERS }, (_, i) => sendRequest(i + 1));
    await Promise.all(promises);

    const totalDuration = Date.now() - startTime;
    console.log(`\nLoad test completed in ${totalDuration}ms.`);
}

runLoadTest();
