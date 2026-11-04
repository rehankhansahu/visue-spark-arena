// ============================================================================
// V Spark 2026 - Super Administrator Controller
// Super Admin Features:
// 1. Teacher Management (Add Teacher, Delete Teacher, Edit Profile Picture & Info)
// 2. Global Website Lock (Read-Only Mode Toggle with Real-Time Broadcast)
// ============================================================================

let superAdminToken = sessionStorage.getItem('superAdminToken') || null;
let superAdminUser = null;
let teachersListCache = [];
let isWebsiteLockedGlobally = false;

// Avatar Presets for instant teacher profile customization
const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
  'https://api.dicebear.com/7.x/bottts/svg?seed=rashid',
  'https://api.dicebear.com/7.x/bottts/svg?seed=chief_judge'
];

/**
 * Check Super Admin Authentication on view switch or load
 */
async function checkSuperAdminAuth() {
  const token = sessionStorage.getItem('superAdminToken');
  const loginView = document.getElementById('superAdminLoginView');
  const dashboardView = document.getElementById('superAdminDashboard');

  if (!token) {
    if (loginView) loginView.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/superadmin/verify-auth', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.user) {
      superAdminUser = data.user;
      superAdminToken = token;
      if (loginView) loginView.classList.add('hidden');
      if (dashboardView) dashboardView.classList.remove('hidden');

      const nameEl = document.getElementById('superAdminNameBadge');
      if (nameEl) nameEl.textContent = data.user.name || 'Head Administrator';

      // Load Super Admin Data
      await loadWebsiteLockStatus();
      await loadTeachersList();
    } else {
      sessionStorage.removeItem('superAdminToken');
      superAdminToken = null;
      if (loginView) loginView.classList.remove('hidden');
      if (dashboardView) dashboardView.classList.add('hidden');
    }
  } catch (err) {
    console.error('[SuperAdmin Auth Error]', err);
    if (loginView) loginView.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
  }
}

/**
 * Handle Super Admin Login Form Submission
 */
async function handleSuperAdminLogin(event) {
  if (event) event.preventDefault();

  const userInput = document.getElementById('superAdminUserInput');
  const passInput = document.getElementById('superAdminPassInput');
  const errEl = document.getElementById('superAdminLoginError');
  const submitBtn = document.getElementById('superAdminSubmitBtn');

  if (!userInput || !passInput) return;
  const username = userInput.value.trim();
  const password = passInput.value.trim();

  if (errEl) errEl.textContent = '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>↻ Authenticating...</span>';
  }

  try {
    const res = await fetch('/api/superadmin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!data.success || !data.token) {
      if (errEl) errEl.textContent = data.message || 'Invalid Super Admin credentials.';
      showToast('Access Denied', data.message || 'Invalid Super Admin credentials.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Unlock Super Admin Console</span>';
      }
      return;
    }

    sessionStorage.setItem('superAdminToken', data.token);
    superAdminToken = data.token;
    superAdminUser = data.user;

    userInput.value = '';
    passInput.value = '';

    showToast('Super Admin Unlocked! 🛡️', 'System Governance Console is now ready.', 'success');
    await checkSuperAdminAuth();
  } catch (err) {
    if (errEl) errEl.textContent = 'Server connection error: ' + err.message;
    showToast('Connection Error', err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Unlock Super Admin Console</span>';
    }
  }
}

/**
 * Handle Super Admin Logout
 */
function handleSuperAdminLogout() {
  sessionStorage.removeItem('superAdminToken');
  superAdminToken = null;
  superAdminUser = null;

  showToast('Logged Out', 'Super Admin session terminated safely.', 'info');
  checkSuperAdminAuth();
}

/**
 * Fetch and Render Website Lock Status
 */
async function loadWebsiteLockStatus() {
  const token = sessionStorage.getItem('superAdminToken');
  if (!token) return;

  try {
    const res = await fetch('/api/superadmin/lock', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      isWebsiteLockedGlobally = Boolean(data.locked);
      updateWebsiteLockUI(isWebsiteLockedGlobally, data.lockedAt, data.lockedBy);
      if (window.applyWebsiteLockState) {
        window.applyWebsiteLockState(isWebsiteLockedGlobally);
      }
    }
  } catch (err) {
    console.error('[Lock Status Error]', err);
  }
}

/**
 * Update Super Admin Website Lock Controls UI
 */
function updateWebsiteLockUI(isLocked, lockedAt, lockedBy) {
  const statusBadge = document.getElementById('superAdminLockStatusBadge');
  const toggleBtn = document.getElementById('superAdminLockToggleBtn');
  const lockDesc = document.getElementById('superAdminLockDescription');

  if (statusBadge) {
    if (isLocked) {
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 flex items-center gap-2 shadow-lg animate-pulse';
      statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-400"></span><span>LOCKED (READ-ONLY MODE ACTIVE)</span>';
    } else {
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-2 shadow-sm';
      statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span><span>UNLOCKED (NORMAL ARENA MODE)</span>';
    }
  }

  if (toggleBtn) {
    if (isLocked) {
      toggleBtn.className = 'btn-cyber px-5 py-2.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/50 hover:bg-emerald-900/60 transition flex items-center gap-2 shadow-lg';
      toggleBtn.innerHTML = '<span>🔓</span><span>Unlock Website (Resume Normal Operations)</span>';
    } else {
      toggleBtn.className = 'btn-cyber px-5 py-2.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/70 border border-rose-500/50 hover:bg-rose-900/60 transition flex items-center gap-2 shadow-lg';
      toggleBtn.innerHTML = '<span>🔒</span><span>Lock Website (Enable Read-Only Mode)</span>';
    }
  }

  if (lockDesc) {
    if (isLocked) {
      lockDesc.textContent = `The arena is currently in READ-ONLY mode (Locked by ${lockedBy || 'Super Admin'}${lockedAt ? ' at ' + new Date(lockedAt).toLocaleTimeString() : ''}). Students cannot register or submit code. Teachers cannot alter contest data. Public can view questions and podium.`;
    } else {
      lockDesc.textContent = 'The arena is in NORMAL mode. Students can register, run & submit code, and teachers can manage contests and grading.';
    }
  }
}

/**
 * Toggle Website Lock (Read-Only Mode)
 */
async function toggleWebsiteLock() {
  const token = sessionStorage.getItem('superAdminToken');
  if (!token) return;

  const targetState = !isWebsiteLockedGlobally;
  const confirmMsg = targetState
    ? 'Are you sure you want to LOCK the website in Read-Only mode?\n\nStudents will not be able to submit code or register, and contest mutations will be paused until you unlock it.'
    : 'Are you sure you want to UNLOCK the website?\n\nNormal student registrations, coding submissions, and contest operations will resume immediately.';

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/superadmin/lock', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ locked: targetState })
    });
    const data = await res.json();

    if (data.success) {
      isWebsiteLockedGlobally = Boolean(data.locked);
      updateWebsiteLockUI(isWebsiteLockedGlobally, data.settings?.lockedAt, data.settings?.lockedBy);
      if (window.applyWebsiteLockState) {
        window.applyWebsiteLockState(isWebsiteLockedGlobally);
      }
      showToast(
        isWebsiteLockedGlobally ? 'Website Locked! 🔒' : 'Website Unlocked! 🔓',
        data.message,
        isWebsiteLockedGlobally ? 'warning' : 'success'
      );
    } else {
      showToast('Error', data.message || 'Failed to update website lock.', 'error');
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

/**
 * Load Teachers List for Super Admin
 */
async function loadTeachersList() {
  const token = sessionStorage.getItem('superAdminToken');
  const container = document.getElementById('superAdminTeachersGrid');
  const badge = document.getElementById('superAdminTeacherCountBadge');
  if (!token || !container) return;

  try {
    const res = await fetch('/api/superadmin/teachers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && Array.isArray(data.teachers)) {
      teachersListCache = data.teachers;
      if (badge) badge.textContent = `${teachersListCache.length} Teachers`;

      if (teachersListCache.length === 0) {
        container.innerHTML = `
          <div class="col-span-full text-center py-8 p-6 glass-panel rounded-xl border border-white/5 space-y-2">
            <div class="text-3xl">👨‍🏫</div>
            <h4 class="text-sm font-bold text-white">No Teachers Registered</h4>
            <p class="text-xs text-slate-400">Click "+ Add New Teacher" above to register faculty judges.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = teachersListCache.map(t => {
        const pic = t.profilePic || `https://api.dicebear.com/7.x/bottts/svg?seed=${t.username}`;

        return `
          <div class="glass-panel p-4 rounded-xl border border-white/10 hover:border-purple-500/40 transition flex flex-col justify-between space-y-3 shadow-md">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-purple-500/30 shrink-0 shadow-sm relative group">
                <img 
                  src="${pic}" 
                  alt="${t.name}" 
                  class="w-full h-full object-cover" 
                  onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${t.username}';" />
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="text-sm font-bold text-white truncate">${t.name}</h4>
                <div class="text-[11px] font-mono text-cyan-300">@${t.username}</div>
                <div class="text-[10px] text-slate-400 truncate mt-0.5">${t.designation || 'Judge'}</div>
                <div class="text-[10px] text-slate-500 truncate">${t.department || 'Department of Computer Science'}</div>
              </div>
            </div>

            <div class="pt-2 border-t border-white/5 flex items-center justify-end gap-1.5">
              <button 
                type="button" 
                onclick="openEditTeacherModal('${t.id}')" 
                class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-purple-300 bg-purple-950/60 border border-purple-500/40 hover:bg-purple-900/50 transition flex items-center gap-1">
                <span>🖼️</span> <span>Edit Profile Pic</span>
              </button>
              <button 
                type="button" 
                onclick="handleDeleteTeacher('${t.id}', '${t.name.replace(/'/g, "\\'")}')" 
                class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-rose-300 bg-rose-950/50 border border-rose-500/40 hover:bg-rose-900/50 transition flex items-center gap-1"
                title="Delete teacher account">
                <span>🗑️</span> <span>Delete</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="col-span-full text-rose-400 p-4 text-xs font-mono">Error loading teachers: ${err.message}</div>`;
  }
}

/**
 * Open Modal to Add a New Teacher
 */
function openAddTeacherModal() {
  const modal = document.getElementById('addTeacherModal');
  const form = document.getElementById('addTeacherForm');
  if (form) form.reset();
  const preview = document.getElementById('newTeacherPicPreview');
  if (preview) {
    preview.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=new';
  }
  if (modal) modal.classList.remove('hidden');
}

function closeAddTeacherModal() {
  const modal = document.getElementById('addTeacherModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Preview Profile Pic in Add Modal
 */
function updateNewTeacherPicPreview() {
  const input = document.getElementById('newTeacherPicInput');
  const preview = document.getElementById('newTeacherPicPreview');
  if (input && preview) {
    preview.src = input.value.trim() || 'https://api.dicebear.com/7.x/bottts/svg?seed=new';
  }
}

function pickNewTeacherPreset(url) {
  const input = document.getElementById('newTeacherPicInput');
  const preview = document.getElementById('newTeacherPicPreview');
  if (input) input.value = url;
  if (preview) preview.src = url;
}

/**
 * Handle Save New Teacher Form Submission
 */
async function handleSaveNewTeacher(event) {
  if (event) event.preventDefault();

  const token = sessionStorage.getItem('superAdminToken');
  if (!token) return;

  const name = document.getElementById('newTeacherNameInput').value.trim();
  const username = document.getElementById('newTeacherUserInput').value.trim();
  const password = document.getElementById('newTeacherPassInput').value.trim();
  const designation = document.getElementById('newTeacherDesignationInput').value.trim();
  const department = document.getElementById('newTeacherDeptInput').value.trim();
  const profilePic = document.getElementById('newTeacherPicInput').value.trim();

  if (!name || !username || !password) {
    showToast('Missing Fields', 'Teacher Name, Username, and Password are required.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/superadmin/teachers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, username, password, designation, department, profilePic })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Teacher Added! 👨‍🏫', data.message, 'success');
      closeAddTeacherModal();
      await loadTeachersList();
    } else {
      showToast('Error', data.message || 'Failed to add teacher.', 'error');
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

/**
 * Open Modal to Edit Teacher Profile Picture & Information
 */
function openEditTeacherModal(id) {
  const teacher = teachersListCache.find(t => t.id === id);
  if (!teacher) return;

  const modal = document.getElementById('editTeacherModal');
  document.getElementById('editTeacherIdInput').value = teacher.id;
  document.getElementById('editTeacherNameInput').value = teacher.name || '';
  document.getElementById('editTeacherUserInput').value = teacher.username || '';
  document.getElementById('editTeacherPassInput').value = '';
  document.getElementById('editTeacherDesignationInput').value = teacher.designation || '';
  document.getElementById('editTeacherDeptInput').value = teacher.department || '';
  document.getElementById('editTeacherPicInput').value = teacher.profilePic || '';

  const preview = document.getElementById('editTeacherPicPreview');
  if (preview) {
    preview.src = teacher.profilePic || `https://api.dicebear.com/7.x/bottts/svg?seed=${teacher.username}`;
  }

  if (modal) modal.classList.remove('hidden');
}

function closeEditTeacherModal() {
  const modal = document.getElementById('editTeacherModal');
  if (modal) modal.classList.add('hidden');
}

function updateEditTeacherPicPreview() {
  const input = document.getElementById('editTeacherPicInput');
  const preview = document.getElementById('editTeacherPicPreview');
  if (input && preview) {
    preview.src = input.value.trim() || 'https://api.dicebear.com/7.x/bottts/svg?seed=preview';
  }
}

function pickEditTeacherPreset(url) {
  const input = document.getElementById('editTeacherPicInput');
  const preview = document.getElementById('editTeacherPicPreview');
  if (input) input.value = url;
  if (preview) preview.src = url;
}

/**
 * Handle Update Teacher Form Submission
 */
async function handleUpdateTeacher(event) {
  if (event) event.preventDefault();

  const token = sessionStorage.getItem('superAdminToken');
  if (!token) return;

  const id = document.getElementById('editTeacherIdInput').value;
  const name = document.getElementById('editTeacherNameInput').value.trim();
  const username = document.getElementById('editTeacherUserInput').value.trim();
  const password = document.getElementById('editTeacherPassInput').value.trim();
  const designation = document.getElementById('editTeacherDesignationInput').value.trim();
  const department = document.getElementById('editTeacherDeptInput').value.trim();
  const profilePic = document.getElementById('editTeacherPicInput').value.trim();

  if (!id || !name || !username) {
    showToast('Missing Fields', 'Name and Username are required.', 'error');
    return;
  }

  const payload = { name, username, designation, department, profilePic };
  if (password) payload.password = password;

  try {
    const res = await fetch(`/api/superadmin/teachers/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast('Profile Updated! ✨', data.message, 'success');
      closeEditTeacherModal();
      await loadTeachersList();

      // If Sir is currently logged in, update Sir dashboard header live
      if (window.updateSirHeaderProfile && data.teacher) {
        window.updateSirHeaderProfile(data.teacher);
      }
    } else {
      showToast('Error', data.message || 'Failed to update teacher.', 'error');
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

/**
 * Handle Delete Teacher
 */
async function handleDeleteTeacher(id, name) {
  const token = sessionStorage.getItem('superAdminToken');
  if (!token) return;

  if (!confirm(`Are you sure you want to delete teacher "${name}"?\n\nThey will no longer be able to log in to Sir's Desk.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/superadmin/teachers/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      showToast('Teacher Deleted', data.message, 'info');
      await loadTeachersList();
    } else {
      showToast('Cannot Delete', data.message || 'Failed to delete teacher.', 'error');
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

// Global Exports
window.checkSuperAdminAuth = checkSuperAdminAuth;
window.handleSuperAdminLogin = handleSuperAdminLogin;
window.handleSuperAdminLogout = handleSuperAdminLogout;
window.toggleWebsiteLock = toggleWebsiteLock;
window.loadTeachersList = loadTeachersList;
window.openAddTeacherModal = openAddTeacherModal;
window.closeAddTeacherModal = closeAddTeacherModal;
window.updateNewTeacherPicPreview = updateNewTeacherPicPreview;
window.pickNewTeacherPreset = pickNewTeacherPreset;
window.handleSaveNewTeacher = handleSaveNewTeacher;
window.openEditTeacherModal = openEditTeacherModal;
window.closeEditTeacherModal = closeEditTeacherModal;
window.updateEditTeacherPicPreview = updateEditTeacherPicPreview;
window.pickEditTeacherPreset = pickEditTeacherPreset;
window.handleUpdateTeacher = handleUpdateTeacher;
window.handleDeleteTeacher = handleDeleteTeacher;
