/**
 * لوحة تحكم الأدمن - Admin Panel Script
 * يتعامل مع جلب، إضافة، تحديث، وحذف المحتوى عبر API
 */

const API_BASE = '/api/content';

// عند تحميل الصفحة بالكامل
document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

function initAdminPanel() {
    loadAdminData();
    setupEventListeners();
}

/**
 * جلب البيانات وعرضها في الجدول
 */
async function loadAdminData() {
    try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error('فشل في جلب البيانات من السيرفر');
        
        const data = await response.json();
        renderAdminTable(data);
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('حدث خطأ أثناء تحميل البيانات', 'error');
    }
}

/**
 * رسم الجدول وعرض البيانات داخل واجهة الأدمن
 */
function renderAdminTable(items) {
    const tableBody = document.getElementById('adminTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!items || items.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="100" style="text-align: center; padding: 20px;">لا توجد بيانات متاحة حالياً</td></tr>`;
        return;
    }

    items.forEach(item => {
        const row = document.createElement('tr');
        
        // تخصيص الأعمدة بناءً على الحقول المتوفرة في الكائن (العنوان، الوصف، الحالة، إلخ)
        row.innerHTML = `
            <td>${item.id || item._id || ''}</td>
            <td><strong>${item.title || item.name || 'بدون عنوان'}</strong></td>
            <td>${item.category || item.type || '-'}</td>
            <td class="actions-cell">
                <button class="btn-edit" onclick="openEditModal('${item.id || item._id}')">تعديل</button>
                <button class="btn-delete" onclick="deleteItem('${item.id || item._id}')">حذف</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * إعداد مستمعي الأحداث للأزرار والنماذج (Forms)
 */
function setupEventListeners() {
    const form = document.getElementById('adminItemForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const itemId = document.getElementById('itemId')?.value;
            const payload = {
                title: document.getElementById('itemTitle')?.value,
                description: document.getElementById('itemDescription')?.value,
                category: document.getElementById('itemCategory')?.value,
            };

            await saveItem(itemId, payload);
            form.reset();
            if (document.getElementById('itemId')) document.getElementById('itemId').value = '';
        });
    }
}

/**
 * حفظ عنصر جديد أو تحديث عنصر موجود (POST / PUT)
 */
async function saveItem(id, payload) {
    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}?id=${id}` : API_BASE;
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'فشل حفظ البيانات');
        }

        showNotification(id ? 'تم التعديل بنجاح' : 'تمت الإضافة بنجاح', 'success');
        loadAdminData();
        
        // إغلاق النافذة المنخفضة أو المودال إن وجد
        closeModal();
    } catch (error) {
        console.error('Error saving item:', error);
        showNotification(error.message, 'error');
    }
}

/**
 * حذف عنصر عبر الـ API (DELETE)
 */
async function deleteItem(id) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا العنصر؟')) return;
    
    try {
        const response = await fetch(`${API_BASE}?id=${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('فشل الحذف من السيرفر');

        showNotification('تم الحذف بنجاح', 'success');
        loadAdminData();
    } catch (error) {
        console.error('Error deleting item:', error);
        showNotification('حدث خطأ أثناء عملية الحذف', 'error');
    }
}

/**
 * فتح نافذة التعديل وتعبئة البيانات القديمة
 */
async function openEditModal(id) {
    try {
        const response = await fetch(API_BASE);
        const items = await response.json();
        const item = items.find(i => (i.id == id || i._id == id));

        if (!item) throw new Error('العنصر غير موجود');

        // تعبئة حقول نموذج التعديل (تأكد من مطابقة الـ IDs في ملف الـ HTML الخاص بك)
        if (document.getElementById('itemId')) document.getElementById('itemId').value = item.id || item._id;
        if (document.getElementById('itemTitle')) document.getElementById('itemTitle').value = item.title || item.name || '';
        if (document.getElementById('itemDescription')) document.getElementById('itemDescription').value = item.description || '';
        if (document.getElementById('itemCategory')) document.getElementById('itemCategory').value = item.category || '';

        // إظهار المودال (إذا كان لديك نافذة منبثقة)
        const modal = document.getElementById('adminModal');
        if (modal) modal.style.display = 'block';

    } catch (error) {
        console.error('Error opening edit modal:', error);
        showNotification('فشل جلب بيانات العنصر للتعديل', 'error');
    }
}

/**
 * إغلاق نافذة التعديل/الإضافة المنبثقة
 */
function closeModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'none';
}

/**
 * نظام إشعارات مرئي خفيف وسريع للمستخدم
 */
function showNotification(message, type = 'success') {
    const existingNotification = document.querySelector('.admin-notification');
    if (existingNotification) existingNotification.remove();

    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.innerText = message;
    notification.style.cssText = `
        position: fixed; bottom: 20px; left: 20px; z-index: 99999;
        padding: 12px 24px; border-radius: 6px; color: #fff; font-size: 14px;
        background-color: ${type === 'success' ? '#28a745' : '#dc3545'};
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: system-ui, -apple-system, sans-serif;
        transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 3000);
    }, 2500);
}
