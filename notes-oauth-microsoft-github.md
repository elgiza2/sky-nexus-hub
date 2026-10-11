# إضافة تسجيل الدخول بـ Microsoft و GitHub — دليل التنفيذ

> المشروع على Supabase: `qdnqxjzjecaieuavagvq`
> **رابط الكولباك الرسمي الذي تحتاجه في كل مكان:**
> `https://qdnqxjzjecaieuavagvq.supabase.co/auth/v1/callback`

---

## الحالة الحالية (تم فحصها فعليًا)

| المزوّد | الحالة | ملاحظة |
|---|---|---|
| Google | ✅ شغال | بيرجّع تحويل لصفحة جوجل |
| **GitHub** | ❌ غير مُفعّل | `Unsupported provider: provider is not enabled` |
| **Microsoft (Azure)** | ❌ غير مُفعّل | نفس الرسالة |
| Apple | ❌ غير مُفعّل | لو عايزه كمان |

**الكود جاهز من ناحيتي:** أزرار "Continue with GitHub" و "Continue with Microsoft" اتضافت في صفحة الدخول (نسخة الموبايل والكمبيوتر) وبقت بتنده المزوّد صح — ناقص بس **تفعيل المزوّدين في لوحة Supabase** بالمفاتيح.

---

## 1) GitHub — إزاي تجيب المفاتيح

1. افتح: https://github.com/settings/developers
2. اضغط **OAuth Apps** ← **New OAuth App**.
3. املأ كده بالظبط:
   - **Application name:** `Megsy AI`
   - **Homepage URL:** `https://www.megsyai.com`
   - **Authorization callback URL:** `https://qdnqxjzjecaieuavagvq.supabase.co/auth/v1/callback`
4. **Register application**.
5. هتلاقي **Client ID** → انسخه.
6. اضغط **Generate a new client secret** → انسخ الـ Secret (بيظهر مرة واحدة بس).

**اللي هتحتاجه:** `Client ID` + `Client Secret`

---

## 2) Microsoft — إزاي تجيب المفاتيح

1. افتح: https://portal.azure.com (بحساب العمل أو حساب Microsoft شخصي).
2. ابحث فوق عن **Microsoft Entra ID** (كان اسمه Azure Active Directory) وادخله.
3. من القائمة: **App registrations** ← **New registration**.
4. املأ:
   - **Name:** `Megsy AI`
   - **Supported account types:** اختر
     **Accounts in any organizational directory and personal Microsoft accounts**
     (ده اللي يخلي أي حد بيدخل بحساب مايكروسوفت عادي أو شركة).
   - **Redirect URI:** من القائمة اختر **Web** وحط:
     `https://qdnqxjzjecaieuavagvq.supabase.co/auth/v1/callback`
5. **Register**.
6. من صفحة التطبيق انسخ **Application (client) ID**.
7. من القائمة الجانبية: **Certificates & secrets** ← **Client secrets** ← **New client secret** → مدة الصلاحية (يفضّل 24 شهر) → **Add** → انسخ **Value** فورًا (مش هيتعرض تاني).
8. من **API permissions** ← **Add a permission** ← **Microsoft Graph** ← **Delegated permissions** → أضف:
   `openid`, `email`, `profile`, `User.Read` ثم **Grant admin consent** (لو الحساب بيسمح).

**اللي هتحتاجه:** `Application (client) ID` + `Client secret Value`
(في Supabase اسم المزوّد: **Azure**، وسيب خانة Azure Tenant URL على `common`.)

---

## 3) تفعيلهم في Supabase (الخطوة الأخيرة)

1. افتح: https://supabase.com/dashboard/project/qdnqxjzjecaieuavagvq/auth/providers
2. **GitHub** → شغّل **Enable Sign in with GitHub** → الصق Client ID + Secret → **Save**.
3. **Azure** → شغّل **Enable Sign in with Azure** → الصق Client ID + Secret (Tenant URL: `common`) → **Save**.
4. اتأكد من: https://supabase.com/dashboard/project/qdnqxjzjecaieuavagvq/auth/url-configuration
   - **Site URL:** `https://www.megsyai.com`
   - **Redirect URLs** (كل واحدة في سطر):
     - `https://www.megsyai.com/**`
     - `https://megsyai.com/**`
     - `https://agentsky-nexus-3df67cfc.vercel.app/**`
5. جرّب على `https://www.megsyai.com/auth` — هتلاقي الأزرار: Google، Apple، **Microsoft**، **GitHub**.

---

## نصيحة أمان

- الـ Secrets دي **مش** بتتحط في الكود خالص — بتتحط في Supabase بس، والكود بيتعامل معاها من غير ما يشوفها.
- لو الـ Secret اتسرّب يومًا، اعمل **Regenerate** من GitHub/Azure وحدّثه في Supabase.

---

## لو عايزني أعمل خطوات Supabase بنفسي

محتاج **Personal Access Token** من Supabase:
https://supabase.com/dashboard/account/tokens ← **Generate new token** ← ابعتلي التوكن (بيبدأ بـ `sbp_`) + الـ Client ID و Secret، وأنا أظبط الإعدادات كلها من غير ما تلمس اللوحة.
