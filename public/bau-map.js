/* Saee Plus — BAU Salt campus Google Maps */
(() => {
  "use strict";

  const bauCampusPlaces = [
    { name: "كلية الذكاء الاصطناعي", category: "الكليات والعمادات", query: "Faculty of Artificial Intelligence, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "كلية السلط التقنية", category: "الكليات والعمادات", query: "Al-Salt Technical College, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "كلية الهندسة", category: "الكليات والعمادات", query: "Faculty of Engineering, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "كلية تكنولوجيا المعلومات والاتصالات", category: "الكليات والعمادات", query: "Prince Abdullah Bin Ghazi Faculty for Information and Communication Technology, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "كلية التمريض", category: "الكليات والعمادات", query: "Faculty of Nursing, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "كلية العلوم", category: "الكليات والعمادات", query: "Faculty of Science, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "كلية الأعمال", category: "الكليات والعمادات", query: "Faculty of Business, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "كلية السلط للعلوم الإنسانية", category: "الكليات والعمادات", query: "Al-Salt College for Human Sciences, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "كلية الحقوق والدراسات العليا", category: "الكليات والعمادات", query: "Faculty of Law and Deanship of Graduate Studies, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "كلية الزراعة التكنولوجية", category: "الكليات والعمادات", query: "Faculty of Agricultural Technology, Al-Balqa Applied University, As-Salt, Jordan" },

    { name: "عمادة شؤون الطلبة", category: "الكليات والعمادات", query: "Deanship of Student Affairs, Al-Balqa Applied University, As-Salt, Jordan" },

    { name: "رئاسة الجامعة", category: "الإدارة والخدمات", query: "Presidency Unit, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "وحدة التعاون والعلاقات الدولية", category: "الإدارة والخدمات", query: "Cooperation and International Relations Unit, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "وحدة الامتحانات", category: "الإدارة والخدمات", query: "Examination Unit, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "المكاتب الإدارية", category: "الإدارة والخدمات", query: "Administration Offices, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "وحدة القبول والتسجيل", category: "الإدارة والخدمات", query: "Admission and Registration Unit, Al-Balqa Applied University, As-Salt, Jordan" },

    { name: "المكتبة", category: "المرافق الجامعية", query: "Library, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "مركز الحاسوب", category: "المرافق الجامعية", query: "Computer Centre, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "قاعات المحاضرات", category: "المرافق الجامعية", query: "Lecture Premises, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "مركز الابتكار والإبداع وريادة الأعمال", category: "المرافق الجامعية", query: "Innovation Creativity and Entrepreneurship Centre, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "مطعم الجامعة", category: "المرافق الجامعية", query: "University Restaurant, Al-Balqa Applied University, As-Salt, Jordan" },

    { name: "الملعب الرياضي", category: "المرافق الرياضية", query: "Stadium, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "ملعب الخماسي", category: "المرافق الرياضية", query: "Futsal, Al-Balqa Applied University, As-Salt, Jordan" },
    { name: "بوابات الجامعة", category: "المداخل والبوابات", query: "University Gates, Al-Balqa Applied University, As-Salt, Jordan" }
  ];

  const campusCenter = "32.02448,35.71693";
  let selectedIndex = 0;
  let selectedCategory = "الكل";

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  const googleSearch = query =>
    "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);

  const googleDirections = query =>
    "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(query);

  // Search for the selected place within the named BAU Salt campus context.
  // Keep the full university and city in every query to reduce similarly named results.
  const mapEmbed = query =>
    "https://maps.google.com/maps?q=" + encodeURIComponent(query) + "&z=17&output=embed";

  function renderBauMap() {
    const main = document.getElementById("main");
    if (!main) return;

    const current = bauCampusPlaces[selectedIndex] || bauCampusPlaces[0];
    const categories = ["الكل", ...new Set(bauCampusPlaces.map(place => place.category))];
    const visiblePlaces = bauCampusPlaces
      .map((place, index) => ({ ...place, index }))
      .filter(place => selectedCategory === "الكل" || place.category === selectedCategory);

    const title = window.SAI_DEFAULTS?.services?.find(service => service[0] === "map")?.[2] || "خريطة الجامعة";
    const description = "خريطة جامعة البلقاء التطبيقية – الحرم الرئيسي في السلط. اختر المبنى لعرض موقعه وفتح الاتجاهات عبر Google Maps.";
    const header = typeof window.headerPage === "function"
      ? window.headerPage(title, description)
      : `<div class="page-head"><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>`;

    main.innerHTML = `
      <div class="container bau-campus-page">
        ${header}
        <div class="demo-note">
          أسماء الكليات والمرافق مستندة إلى
          <a href="https://www.bau.edu.jo/bauar/Units/SIR/media/BAU_Map.pdf" target="_blank" rel="noopener noreferrer">مخطط الحرم الجامعي الرسمي (PDF)</a>.
          بعض المباني قد تظهر في Google Maps كنتيجة بحث باسمها وليس كدبوس مستقل؛ تأكد من اسم النتيجة قبل بدء التنقّل.
        </div>

        <div class="toolbar">
          <div class="chips" aria-label="تصنيف المباني">
            ${categories.map((category, index) => `
              <button type="button" class="chip ${category === selectedCategory ? "selected" : ""}" data-bau-category="${index}">
                ${escapeHTML(category)}
              </button>
            `).join("")}
          </div>
        </div>

        <div class="bau-map-layout">
          <section class="bau-map-main">
            <div class="bau-map-heading">
              <div>
                <span class="kicker">المبنى المحدد</span>
                <h2>${escapeHTML(current.name)}</h2>
                <p>اختَر مبنى من القائمة المجاورة لتحديث الخريطة وفتح الاتجاهات إليه.</p>
              </div>
            </div>
            <iframe
              class="bau-google-map"
              title="خريطة Google Maps: ${escapeHTML(current.name)}"
              src="${mapEmbed(current.query)}"
              loading="lazy"
              allowfullscreen
              referrerpolicy="no-referrer-when-downgrade">
            </iframe>
            <div class="bau-map-actions">
              <a class="button small" href="${googleSearch(current.query)}" target="_blank" rel="noopener noreferrer">عرض الموقع على Google Maps ↗</a>
              <a class="button small light" href="${googleDirections(current.query)}" target="_blank" rel="noopener noreferrer">كيف أوصل؟ ↗</a>
              <a class="bau-campus-plan" href="https://www.bau.edu.jo/bauar/Units/SIR/media/BAU_Map.pdf" target="_blank" rel="noopener noreferrer">المخطط الرسمي للحرم الجامعي</a>
            </div>
            <p class="bau-map-hint">زر «كيف أوصل؟» يفتح Google Maps لتحديد نقطة الانطلاق تلقائيًا من هاتفك أو إدخالها يدويًا.</p>
          </section>

          <aside class="bau-map-places" aria-label="قائمة مباني ومرافق الجامعة">
            <h2>مباني ومرافق الجامعة</h2>
            <p class="bau-map-list-intro">اضغط على اسم المبنى لعرض موقعه على الخريطة.</p>
            <div class="bau-map-place-list">
              ${visiblePlaces.map(place => `
                <button type="button" class="place-card ${place.index === selectedIndex ? "selected" : ""}" data-bau-place="${place.index}" aria-pressed="${place.index === selectedIndex}">
                  <h3>${escapeHTML(place.name)}</h3>
                  <p>${escapeHTML(place.category)} · ${place.index === selectedIndex ? "محدد حاليًا" : "عرض الموقع ←"}</p>
                </button>
              `).join("")}
            </div>
          </aside>
        </div>
      </div>

      <style id="bau-campus-map-style">
        .bau-campus-page { padding-bottom: 44px; }
        .bau-map-layout { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(260px,.8fr); gap:22px; align-items:start; margin:18px 0 58px; }
        .bau-map-main { min-width:0; padding:18px; background:#fffefb; border:1px solid var(--line); border-radius:14px; }
        .bau-map-heading { margin-bottom:14px; }
        .bau-map-heading h2 { color:var(--green); font-size:22px; margin:6px 0 8px; }
        .bau-map-heading p,.bau-map-hint,.bau-map-list-intro { color:#78867b; font-size:12px; line-height:1.9; margin:0 0 10px; }
        .bau-google-map { display:block; width:100%; height:500px; border:0; border-radius:10px; background:#e9eddf; }
        .bau-map-actions { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:14px; }
        .bau-map-actions .button { gap:8px; }
        .bau-campus-plan { display:inline-flex; align-items:center; justify-content:center; min-height:40px; padding:9px 12px; border:1px solid var(--line); border-radius:8px; color:var(--green); font-size:12px; font-weight:600; }
        .bau-map-hint { margin:12px 0 0; }
        .bau-map-places { min-width:0; max-height:780px; overflow:auto; padding:17px; background:#fffefb; border:1px solid var(--line); border-radius:14px; }
        .bau-map-places h2 { color:var(--green); font-size:18px; margin:0 0 8px; }
        .bau-map-place-list { display:grid; gap:9px; }
        .bau-map-places .place-card { width:100%; margin:0; cursor:pointer; text-align:right; }
        .bau-map-places .place-card h3 { line-height:1.65; }
        .bau-map-places .place-card.selected { border-color:var(--green); background:#eaf0e5; }
        @media(max-width:850px) {
          .bau-map-layout { grid-template-columns:1fr; }
          .bau-map-places { max-height:none; overflow:visible; }
        }
        @media(max-width:700px) {
          .bau-map-layout { gap:14px; }
          .bau-map-main,.bau-map-places { padding:12px; }
          .bau-google-map { height:360px; }
          .bau-map-actions { flex-direction:column; align-items:stretch; }
          .bau-map-actions .button,.bau-campus-plan { width:100%; justify-content:center; text-align:center; }
        }
      </style>`;

    main.querySelectorAll("[data-bau-category]").forEach(button => {
      button.addEventListener("click", () => {
        selectedCategory = categories[Number(button.dataset.bauCategory)] || "الكل";
        const stillVisible = bauCampusPlaces.findIndex((place, index) =>
          index === selectedIndex && (selectedCategory === "الكل" || place.category === selectedCategory)
        );
        if (stillVisible < 0) {
          selectedIndex = bauCampusPlaces.findIndex(place => selectedCategory === "الكل" || place.category === selectedCategory);
        }
        renderBauMap();
      });
    });

    main.querySelectorAll("[data-bau-place]").forEach(button => {
      button.addEventListener("click", () => {
        selectedIndex = Number(button.dataset.bauPlace);
        renderBauMap();
        const map = main.querySelector(".bau-google-map");
        if (map) map.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  // Override the demo diagram with the real Google Maps experience on the #map route.
  window.mapPage = renderBauMap;
  window.mapCategory = function(index) {
    const categories = ["الكل", ...new Set(bauCampusPlaces.map(place => place.category))];
    selectedCategory = categories[index] || "الكل";
    const activeCategory = selectedCategory;
    if (!bauCampusPlaces[selectedIndex] || (activeCategory !== "الكل" && bauCampusPlaces[selectedIndex].category !== activeCategory)) {
      selectedIndex = bauCampusPlaces.findIndex(place => activeCategory === "الكل" || place.category === activeCategory);
    }
    renderBauMap();
  };

  // If the visitor opened the map page directly, refresh the already-rendered demo.
  if (location.hash === "#map") renderBauMap();
})();
