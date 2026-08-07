

async function testNotifications() {
  const baseUrl = 'http://localhost:4000/api';
  console.log('Testing Notifications API...');

  try {
    // Note: Assuming we need auth tokens, this test might need a valid token to run.
    // For now, we will just try to hit the endpoints to ensure they exist and return 401 instead of 404.
    
    // Test 1: Get Notifications
    let res = await fetch(`${baseUrl}/notifications`);
    console.log(`GET /notifications -> Status: ${res.status}`);
    
    // Test 2: Mark All as Read
    res = await fetch(`${baseUrl}/notifications/read-all`, { method: 'PUT' });
    console.log(`PUT /notifications/read-all -> Status: ${res.status}`);
    
    // Test 3: Broadcast Notification
    res = await fetch(`${baseUrl}/notifications/broadcast`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', body: 'Test body' })
    });
    console.log(`POST /notifications/broadcast -> Status: ${res.status}`);
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

testNotifications();
