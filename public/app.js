# التعديلات المطلوبة في public/app.js

## 1) استبدال دالة placementSections بالكامل

ابحث عن الدالة الحالية:

```js
function placementSections(placement){
  if(placement==='projects_opportunities')return ['projects','opportunities'];
  if(placement==='opportunities')return ['opportunities'];
  if(placement==='opportunities_discounts')return ['opportunities','discounts'];
  return ['projects'];
}
```

واستبدلها بهذه:

```js
function placementSections(placement){
  // المشروع يظهر في المشاريع الشبابية دائماً. ويظهر في الخصومات فقط عند وجود خصم فعلي.
  if(placement==='projects_discounts'||placement==='opportunities_discounts'){
    return base.some(item=>item.type==='discounts')?['projects','discounts']:['projects'];
  }
  return ['projects'];
}
```

## 2) إظهار خيار الخصومات فقط عند وجود خصم

داخل `communityProjectForm()` ابحث عن السطرين:

```js
  const placement=p.placement||'projects';
```

وأضف/استبدل بهما:

```js
  const hasSaeeDiscount=Array.isArray(SiteStore.state.items)&&SiteStore.state.items.some(item=>item.type==='discounts');
  const placement=hasSaeeDiscount&&(p.placement==='projects_discounts'||p.placement==='opportunities_discounts')?'projects_discounts':'projects';
```

ثم ابحث عن خيارات القائمة الأربعة واستبدلها بهذه:

```js
      <option value="projects" ${placement==='projects'?'selected':''}>المشاريع الشبابية فقط</option>
      ${hasSaeeDiscount?`<option value="projects_discounts" ${placement==='projects_discounts'?'selected':''}>المشاريع الشبابية + خصم سعي</option>`:''}
```

بذلك، إذا لم يكن هناك أي خصم مُضاف في محتوى الموقع، يظهر خيار «المشاريع الشبابية فقط» وحده. عند وجود خصم، يظهر الخيار الثاني.

## 3) تحديث الشاشة بعد تحميل المشاريع

داخل `refreshCommunityProjects()` ابحث عن:

```js
    if(route==='projects'||route==='discounts')listing();
    else if(route==='opportunities')opportunitiesPage();
    else if(route==='home')home();
```

واستبدله بـ:

```js
    if(route==='projects'||route==='discounts')listing();
    else if(route==='home')home();
```

لن تُعرض مشاريع المستخدمين في صفحة «فرص سعي» بعد الآن.
