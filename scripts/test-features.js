// Comprehensive API Test Script for all new features
const BASE = 'https://probation-portal-backend.vercel.app';
const TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtc2lnb2FmcDAwMDBqeTNrc296Ynd5amIiLCJlbWFpbCI6InNhcnRoYWtrYXVzaGlrOTI3QGdtYWlsLmNvbSIsInJvbGUiOiJBRE1JTiIsIm5hbWUiOiJzYXJ0aGFrIHNoYXJtYSIsImlhdCI6MTc4NjEwMTUzMiwiZXhwIjoxNzg4NjkzNTMyfQ.H1KtQj8PVAzuDUHZELo3jhp6Jo2V_63BPf60N2cExz0';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': TOKEN,
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    const result = await fn();
    console.log(`✅ ${name}`, result ? `→ ${JSON.stringify(result).slice(0, 120)}` : '');
    passed++;
    return result;
  } catch (err) {
    console.log(`❌ ${name} → ${err.message}`);
    failed++;
    return null;
  }
}

async function api(method, path, body) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function run() {
  console.log('\n========================================');
  console.log('  API TESTS - All New Features');
  console.log('========================================\n');

  // ── 1. Profile & Password APIs ──
  console.log('── Profile & Password ──');
  
  await test('GET /api/user/me (should include avatarData)', async () => {
    const r = await api('GET', '/api/user/me');
    if (!r.data) throw new Error('No data');
    return { name: r.data.name, email: r.data.email, hasAvatar: !!r.data.avatarData };
  });

  await test('PUT /api/user/profile (update name)', async () => {
    return await api('PUT', '/api/user/profile', { name: 'sarthak sharma' });
  });

  await test('PUT /api/user/change-password (wrong current)', async () => {
    try {
      await api('PUT', '/api/user/change-password', { currentPassword: 'wrongpass', newPassword: 'newpass123' });
      throw new Error('Should have failed');
    } catch (e) {
      if (e.message.includes('401') || e.message.includes('Incorrect')) return 'Correctly rejected';
      throw e;
    }
  });

  // ── 2. Notifications ──
  console.log('\n── Notifications ──');
  
  await test('GET /api/notifications', async () => {
    const r = await api('GET', '/api/notifications');
    return { count: r.data?.length };
  });

  await test('PUT /api/notifications/read-all', async () => {
    return await api('PUT', '/api/notifications/read-all');
  });

  // ── 3. Submission Comments ──
  console.log('\n── Submission Comments ──');
  
  // First, get a submission to test with
  let submissionId = null;
  await test('GET /api/admin/submissions (find a submission)', async () => {
    const r = await api('GET', '/api/admin/submissions');
    if (r.data && r.data.length > 0) {
      submissionId = r.data[0].id;
      return { submissionId, total: r.data.length };
    }
    throw new Error('No submissions found');
  });

  if (submissionId) {
    await test(`POST /api/submissions/${submissionId}/comments (add comment)`, async () => {
      return await api('POST', `/api/submissions/${submissionId}/comments`, { message: 'Test comment from API test script' });
    });

    await test(`GET /api/submissions/${submissionId}/comments (fetch comments)`, async () => {
      const r = await api('GET', `/api/submissions/${submissionId}/comments`);
      return { count: r.data?.length, latest: r.data?.[r.data.length - 1]?.message };
    });
  } else {
    console.log('⏭️  Skipping comment tests (no submissions found)');
  }

  // ── 4. Admin Export CSV ──
  console.log('\n── Admin Export CSV ──');
  
  await test('GET /api/admin/export/attendance (CSV)', async () => {
    const res = await fetch(`${BASE}/api/admin/export/attendance`, { headers });
    if (!res.ok) throw new Error(`${res.status}`);
    const text = await res.text();
    const lines = text.split('\n');
    return { header: lines[0], totalRows: lines.length - 1 };
  });

  await test('GET /api/admin/export/submissions (CSV)', async () => {
    const res = await fetch(`${BASE}/api/admin/export/submissions`, { headers });
    if (!res.ok) throw new Error(`${res.status}`);
    const text = await res.text();
    const lines = text.split('\n');
    return { header: lines[0], totalRows: lines.length - 1 };
  });

  await test('GET /api/admin/export/users (CSV)', async () => {
    const res = await fetch(`${BASE}/api/admin/export/users`, { headers });
    if (!res.ok) throw new Error(`${res.status}`);
    const text = await res.text();
    const lines = text.split('\n');
    return { header: lines[0], totalRows: lines.length - 1 };
  });

  // ── 5. Admin User Management ──
  console.log('\n── Admin User Management ──');
  
  let testUserId = null;
  await test('GET /api/admin/users (list users)', async () => {
    const r = await api('GET', '/api/admin/users');
    // Find a non-admin user for further testing
    const nonAdmin = r.data?.find(u => u.role !== 'ADMIN');
    if (nonAdmin) testUserId = nonAdmin.id;
    return { total: r.data?.length, nonAdminFound: !!nonAdmin };
  });

  if (testUserId) {
    await test(`GET /api/admin/export/users/${testUserId} (single user CSV)`, async () => {
      const res = await fetch(`${BASE}/api/admin/export/users/${testUserId}`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const text = await res.text();
      return { previewLines: text.split('\n').slice(0, 3).join(' | ') };
    });

    // We won't actually delete to preserve data
    await test('DELETE /api/admin/users/:id (admin user - should fail)', async () => {
      const me = await api('GET', '/api/user/me');
      try {
        await api('DELETE', `/api/admin/users/${me.data.id}`);
        throw new Error('Should have failed');
      } catch (e) {
        if (e.message.includes('403') || e.message.includes('Cannot delete')) return 'Correctly blocked admin deletion';
        throw e;
      }
    });
  }

  // ── 6. Export with specific user IDs ──
  console.log('\n── Selective Export ──');
  
  if (testUserId) {
    await test(`GET /api/admin/export/users?userIds=${testUserId} (selective)`, async () => {
      const res = await fetch(`${BASE}/api/admin/export/users?userIds=${testUserId}`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const text = await res.text();
      const lines = text.split('\n').filter(l => l.trim());
      return { totalRows: lines.length - 1, note: 'Should be 1 user' };
    });
  }

  // ── Summary ──
  console.log('\n========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');
}

run().catch(console.error);
