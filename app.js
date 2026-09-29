// বিশ্বব্যাপী কাস্টমার ডাটা সংরক্ষণের জন্য
let currentCustomerData = null;

// DOM লোড হওয়ার পর শুরু
document.addEventListener('DOMContentLoaded', () => {
    // সেভ করা কোনো সেশন আছে কিনা চেক করা
    const savedPhone = localStorage.getItem('dsr_wifi_user');
    if (savedPhone) {
        autoLogin(savedPhone);
    }
});

// ১. স্ক্রিন লোডার টগল
function toggleLoader(show) {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

// ২. লগইন হ্যান্ডলার
async function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const errorText = document.getElementById('login-error');

    errorText.style.display = 'none';
    toggleLoader(true);

    try {
        // Firebase Firestore 'customers' কালেকশন থেকে অনুসন্ধান
        const snapshot = await db.collection('customers')
            .where('phone', '==', phone)
            .where('password', '==', pass)
            .get();

        if (snapshot.empty) {
            errorText.innerText = 'মোবাইল নম্বর অথবা পাসওয়ার্ড ভুল হয়েছে!';
            errorText.style.display = 'block';
            toggleLoader(false);
            return;
        }

        snapshot.forEach(doc => {
            currentCustomerData = { id: doc.id, ...doc.data() };
        });

        // অটো লগইনের জন্য লোকাল স্টোরেজে মোবাইল সেভ
        localStorage.setItem('dsr_wifi_user', phone);

        // ড্যাশবোর্ডের ডাটা আপডেট এবং স্ক্রিন সুইচ
        renderDashboardData();
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';

    } catch (err) {
        console.error("Login Error:", err);
        errorText.innerText = 'সার্ভারে সংযোগ করা যাচ্ছে না! আবার চেষ্টা করুন।';
        errorText.style.display = 'block';
    } finally {
        toggleLoader(false);
    }
}

// অটো লগইন
async function autoLogin(phone) {
    toggleLoader(true);
    try {
        const snapshot = await db.collection('customers').where('phone', '==', phone).get();
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                currentCustomerData = { id: doc.id, ...doc.data() };
            });
            renderDashboardData();
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'block';
        }
    } catch (err) {
        console.error("Auto Login Error:", err);
    } finally {
        toggleLoader(false);
    }
}

// ৩. ড্যাশবোর্ডে কাস্টমারের তথ্য প্রদর্শন
function renderDashboardData() {
    if (!currentCustomerData) return;

    const data = currentCustomerData;

    // নাম
    document.getElementById('user-display-name').innerText = data.name || 'গ্রাহক';
    document.querySelectorAll('.profile-name-text').forEach(el => {
        el.innerText = data.name || 'গ্রাহক';
    });

    // ISP ইউজার ও পাসওয়ার্ড
    document.getElementById('dash-username').innerText = data.ispUsername || '-';
    document.getElementById('dash-password').innerText = data.ispPassword || '-';
    document.getElementById('msg-username').innerText = data.ispUsername || '-';
    document.getElementById('msg-password').innerText = data.ispPassword || '-';

    // প্রোফাইল তথ্য
    document.getElementById('profile-phone').innerText = data.phone || '-';
    document.getElementById('profile-package').innerText = data.package || '-';
}

// ৪. নেভিগেশন ও ট্যাব সুইচ
function switchTab(tabId, element) {
    // সব ট্যাব হাইড করা
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // নির্বাচিত ট্যাব দেখানো
    document.getElementById(tabId).classList.add('active');

    // নেভিগেশন বাটনের এক্টিভ স্টাইল
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    }
}

// স্ক্রোল করার ফাংশনালিটি
function scrollToHistory() {
    const historySection = document.getElementById('history-section');
    if (historySection) {
        historySection.scrollIntoView({ behavior: 'smooth' });
    }
}

// ৫. পেমেন্ট মডাল নিয়ন্ত্রণ
function openPaymentModal() {
    document.getElementById('paymentModal').style.display = 'flex';
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

// পেমেন্ট সাবমিট
async function handlePaymentSubmit(e) {
    e.preventDefault();
    const month = document.getElementById('payment-month').value;
    const trxid = document.getElementById('payment-trxid').value.trim();

    if (!trxid) {
        alert("অনুগগ্রহ করে Transaction ID প্রদান করুন।");
        return;
    }

    toggleLoader(true);

    try {
        // ফায়ারবেসের 'payments' কালেকশনে জমা হবে
        await db.collection('payments').add({
            customerId: currentCustomerData ? currentCustomerData.id : null,
            customerName: currentCustomerData ? currentCustomerData.name : 'Unknown',
            customerPhone: currentCustomerData ? currentCustomerData.phone : '',
            month: month,
            trxid: trxid,
            status: 'Pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("আপনার পেমেন্ট সফলভাবে জমা হয়েছে! এডমিন যাচাই করে এপ্রুভ করবেন।");
        document.getElementById('payment-trxid').value = '';
        closePaymentModal();

    } catch (err) {
        console.error("Payment Submission Error:", err);
        alert("ত্রুটি হয়েছে! আবার চেষ্টা করুন।");
    } finally {
        toggleLoader(false);
    }
}

// ৬. লগআউট
function logout() {
    localStorage.removeItem('dsr_wifi_user');
    currentCustomerData = null;
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}
