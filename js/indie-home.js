(typeof StudygramPrivateSession === "undefined" ? callback => callback() : StudygramPrivateSession.start)(() => {
  document.querySelectorAll('[data-indie-icon]').forEach(element => {
    element.innerHTML = IndiePixel(element.dataset.indieIcon);
  });

  const search = document.getElementById('indie-search');
  const query = document.getElementById('indie-query');
  search.addEventListener('submit', event => {
    event.preventDefault();
    const topic = query.value.trim();
    if (!topic) {
      query.setCustomValidity('Enter a topic to explore.');
      query.reportValidity();
      return;
    }
    const saved = Storage.getTopics().find(set => set.name.toLowerCase() === topic.toLowerCase());
    const parameters = saved ? { topicId: saved.id } : { topic };
    const destination = saved ? 'pages/lesson.html' : 'pages/study.html';
    window.location.assign(`${destination}?${new URLSearchParams(parameters)}`);
  });
  query.addEventListener('input', () => query.setCustomValidity(''));

  document.getElementById('indie-talk').addEventListener('click', () => {
    requestAnimationFrame(() => document.getElementById('lily-input').focus({ preventScroll: true }));
  });

  const techEventsLink = document.getElementById('indie-tech-events');
  function refreshTechEventsLink() {
    techEventsLink.hidden = !Storage.getExploreNotebook().saved.includes('technology');
  }

  refreshTechEventsLink();
  window.addEventListener('pageshow', event => {
    if (event.persisted) refreshTechEventsLink();
  });
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === 'sg_student' || event.key === Storage.getExploreNotebookKey()) {
      refreshTechEventsLink();
    }
  });

  if (!window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('indie-in-view');
      observer.unobserve(entry.target);
    }
  }, { threshold: .12 });
  document.querySelectorAll('.indie-section, .indie-duo').forEach(section => observer.observe(section));
});
