// ================== FIRESTORE COLLECTIONS ==================
// customers/{phone} -> { isp, name, password, ispUsername, ispPassword, nid, package, paid, status }
//   (same collection/fields the customer-facing app.js reads for login)
// payments/{autoId} -> { phone, name, amount, date, createdAt }
// =============================================================

let customersList = []; // kept in sync live from Firestore
let totalIncome = 0;

function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

// -------------------- MONTH DISPLAY --------------------
function updateMonth() {
    const months = ["জানুয়ারী", "ফেব্রুয়ারী", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const date = new Date();
    document.getElementById('current-month-display').innerText = `মাস: ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// -------------------- TABS --------------------
function switchAdminTab(tabId, btnElement) {
    document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
}

// -------------------- AUTO LINE STATUS (3rd day logic, display only) --------------------
function effectiveStatus(cust) {
    const currentDay = new Date().getDate();
    if (currentDay >= 3 && !cust.paid) return 'Disabled Line';
    return cust.status || 'Active Line';
}

// -------------------- LIVE CUSTOMERS LISTENER --------------------
function listenCustomers() {
    db.collection('customers').onSnapshot(snapshot => {
        customersList = snapshot.docs.map(doc => ({ phone: doc.id, ...doc.data() }));
        updateCustomerDropdown();
        renderCustomers();
    }, err => console.error(err));
}

// -------------------- LIVE PAYMENTS LISTENER --------------------
function listenPayments() {
    db.collection('payments').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const tbody = document.getElementById('bill-table-body');
        tbody.innerHTML = '';
        totalIncome = 0;

        snapshot.forEach(doc => {
            const p = doc.data();
            totalIncome += Number(p.amount) || 0;
            tbody.innerHTML += `
                <tr>
                    <td>${p.date || '-'}</td>
                    <td>${p.name || '-'}</td>
                    <td>${p.amount}৳</td>
                    <td><span class="badge-done">Done</span></td>
                </tr>
            `;
        });

        document.getElementById('total-amount-display').innerText = `${totalIncome} টাকা`;
    }, err => console.error(err));
}

// -------------------- CUSTOMER DROPDOWN (for payment entry) --------------------
function updateCustomerDropdown() {
    const selectEl = document.getElementById('pay-customer-select');
    const currentVal = selectEl.value;
    selectEl.innerHTML = '<option value="">কাস্টমার সিলেক্ট করুন</option>';
    customersList.forEach(c => {
        selectEl.innerHTML += `<option value="${c.phone}">${c.name} (${c.phone})</option>`;
    });
    selectEl.value = currentVal;
}

// -------------------- ADD PAYMENT ENTRY --------------------
async function addPaymentRecord(event) {
    event.preventDefault();

    const dateVal = document.getElementById('pay-date').value;
    const phone = document.getElementById('pay-customer-select').value;
    const amountVal = parseInt(document.getElementById('pay-amount').value);

    const cust = customersList.find(c => c.phone === phone);
    if (!cust) { alert('কাস্টমার সিলেক্ট করুন।'); return; }

    const d = new Date(dateVal);
    const formattedDate = `${d.getDate()}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;

    showLoading(true);
    try {
        await db.collection('payments').add({
            phone: phone,
            name: cust.name,
            amount: amountVal,
            date: formattedDate,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('customers').doc(phone).update({
            paid: true,
            status: 'Active Line'
        });

        event.target.reset();
        alert('পেমেন্ট সফলভাবে জমা হয়েছে এবং কাস্টমারের লাইন অটো অন হয়ে গেছে!');
    } catch (err) {
        console.error(err);
        alert('সেভ করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    }
    showLoading(false);
}

// -------------------- RENDER CUSTOMER CARDS --------------------
function renderCustomers() {
    const container = document.getElementById('all-customers-container');
    container.innerHTML = '';

    customersList.forEach(cust => {
        const status = effectiveStatus(cust);
        const isOnline = status === 'Active Line';
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.innerHTML = `
            <div class="cust-header">
                <div>
                    <div class="cust-name">${cust.name || '-'}</div>
                    <span style="font-size: 12px; color: #64748b;">মোবাইল: ${cust.phone} | পেমেন্ট: <b style="color: ${cust.paid ? '#16a34a' : '#dc2626'}">${cust.paid ? 'Paid' : 'Unpaid'}</b></span>
                </div>
                <span class="btn-sm ${isOnline ? 'btn-on' : 'btn-off'}">${status}</span>
            </div>

            <div class="doc-grid">
                <div class="doc-item">ISP Name: <span>${cust.isp || '-'}</span></div>
                <div class="doc-item">User Name: <span>${cust.ispUsername || '-'}</span></div>
                <div class="doc-item">ISP Password: <span>${cust.ispPassword || '-'}</span></div>
                <div class="doc-item">লগইন পাসওয়ার্ড: <span>${cust.password || '-'}</span></div>
                <div class="doc-item">NID নম্বর: <span>${cust.nid || '-'}</span></div>
                <div class="doc-item">প্যাকেজ: <span>${cust.package || '-'}</span></div>
            </div>

            <div class="action-row">
                <button class="btn-sm btn-off" onclick="toggleLine('${cust.phone}', 'off')">অফ করুন</button>
                <button class="btn-sm btn-on" onclick="toggleLine('${cust.phone}', 'on')">অন করুন</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// -------------------- MANUAL TOGGLE LINE --------------------
async function toggleLine(phone, action) {
    showLoading(true);
    try {
        await db.collection('customers').doc(phone).update({
            status: action === 'off' ? 'Disabled Line' : 'Active Line'
        });
    } catch (err) {
        console.error(err);
        alert('স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে।');
    }
    showLoading(false);
}

// -------------------- REGISTER NEW CUSTOMER --------------------
async function handleAddCustomer(event) {
    event.preventDefault();

    const phone = document.getElementById('cust-mobile').value.trim();

    const newCust = {
        isp: document.getElementById('cust-isp').value.trim(),
        name: document.getElementById('cust-name').value.trim(),
        ispUsername: document.getElementById('cust-username').value.trim(),
        ispPassword: document.getElementById('cust-pass').value.trim(),
        password: document.getElementById('cust-login-pass').value.trim(),
        nid: document.getElementById('cust-nid').value.trim(),
        package: document.getElementById('cust-package').value,
        paid: true,
        status: 'Active Line'
    };

    showLoading(true);
    try {
        await db.collection('customers').doc(phone).set(newCust, { merge: true });
        alert('নতুন কাস্টমার সফলভাবে সেভ হয়েছে!');
        event.target.reset();
        switchAdminTab('tab-customers', document.querySelectorAll('.tab-btn')[1]);
    } catch (err) {
        console.error(err);
        alert('সেভ করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    }
    showLoading(false);
}

// -------------------- INIT --------------------
window.addEventListener('DOMContentLoaded', () => {
    updateMonth();
    listenCustomers();
    listenPayments();
});
