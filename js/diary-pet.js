(typeof StudygramPrivateSession === "undefined" ? callback => callback() : StudygramPrivateSession.start)(() => {
  const pet = document.getElementById("diary-pet");
  if (!pet) return;
  const choice = document.getElementById("diary-pet-choice");
  const play = document.getElementById("diary-pet-play");
  const status = document.getElementById("diary-pet-status");
  const sprite = play.querySelector(".diary-pet-sprite");
  const names = new Map([["hello-kitty", "Hello Kitty"], ["spider-man", "Spider-Man"], ["batman", "Batman"]]);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "sg_diary_pet_v1";
  let hopAnimation;

  function hop() {
    if (motion.matches) return;
    hopAnimation?.cancel();
    hopAnimation = sprite.animate?.([
      { transform: "translateY(0)" },
      { transform: "translateY(-10px)", offset: .38 },
      { transform: "translateY(0)", offset: .72 },
      { transform: "translateY(-3px)", offset: .84 },
      { transform: "translateY(0)" },
    ], { duration: 800, easing: "ease-in-out" });
  }

  function render(id) {
    const selected = names.has(id) ? id : "batman";
    choice.value = selected;
    document.body.dataset.diaryPet = selected;
    const name = names.get(selected);
    play.setAttribute("aria-label", motion.matches ? `Say hello to ${name}` : `Make ${name} hop`);
    status.textContent = "Tap your companion to say hello.";
  }

  function restore() {
    let saved;
    try { saved = Storage.getPrivateValue(storageKey); } catch { /* Use the default when storage is unavailable. */ }
    render(saved);
  }

  choice.addEventListener("change", async () => {
    render(choice.value);
    try {
      Storage.setPrivateValue(storageKey, choice.value);
      await Storage.flush();
    } catch {
      status.textContent = "Your companion is set for this visit.";
    }
    hop();
  });
  play.addEventListener("click", () => {
    if (motion.matches) {
      status.textContent = `${names.get(choice.value)} says hello!`;
      return;
    }
    hop();
  });
  motion.addEventListener("change", () => {
    if (motion.matches) hopAnimation?.cancel();
    render(choice.value);
  });
  window.addEventListener("storage", event => {
    if (event.key === null || event.key === "sg_student" || event.key === storageKey) restore();
  });
  window.addEventListener("pageshow", event => { if (event.persisted) restore(); });
  restore();
  hop();
});
