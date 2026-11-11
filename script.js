(function () {
  'use strict';

  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
  var sceneNum = document.getElementById('sceneNum');
  var progressBar = document.getElementById('progressBar');
  var prevBtn = document.getElementById('prevBtn');
  var soundToggle = document.getElementById('soundToggle');
  var s12 = document.getElementById('s12');
  var finalBadge = document.getElementById('finalBadge');
  var evalStatus = document.getElementById('evalStatus');
  var evalResult = document.getElementById('evalResult');
  var evalScoreEl = document.getElementById('evalScore');
  var evalComment = document.getElementById('evalComment');
  var evalQuizzes = Array.prototype.slice.call(document.querySelectorAll('#s11 .quiz'));

  var current = 1;
  var soundOn = true;
  var voices = [];
  var evalScore = 0;
  var lastScore = null;
  var TOTAL = scenes.length;

  /* ---------- Speech Synthesis ---------- */
  function findVoice() {
    try {
      voices = speechSynthesis.getVoices();
    } catch (e) {}
  }

  try {
    findVoice();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = findVoice;
    }
  } catch (e) {}

  function voiceFor(language) {
    var exact = language.toLowerCase();
    var prefix = exact.split('-')[0];
    return voices.find(function(v){ return (v.lang || '').toLowerCase() === exact; }) ||
      voices.find(function(v){ return (v.lang || '').toLowerCase().split('-')[0] === prefix; }) || null;
  }

  function applySpeechLanguage(utterance, language) {
    utterance.lang = language;
    var selectedVoice = voiceFor(language);
    if (selectedVoice) utterance.voice = selectedVoice;
  }

  function sceneLanguage(scene) {
    return scene.id === 's11' ? 'en-US' : 'id-ID';
  }

  var speechGeneration = 0;
  function cancelSpeech() {
    speechGeneration++;
    try { speechSynthesis.cancel(); speechSynthesis.resume(); } catch (e) {}
    document.querySelectorAll('.narrating').forEach(function(el){el.classList.remove('narrating');});
  }

  function speak(text, language) {
    language = language || 'id-ID';
    cancelSpeech();
    if (!soundOn || !text || !('speechSynthesis' in window)) return;
    var token = speechGeneration;
    var parts = text.match(/[^.!?]+[.!?]?/g) || [text];
    var i = 0;
    function next() {
      if (token !== speechGeneration || i >= parts.length) {
        document.querySelectorAll('.narrating').forEach(function(el){el.classList.remove('narrating');});
        return;
      }
      try {
        var u = new SpeechSynthesisUtterance(parts[i]);
        applySpeechLanguage(u, language); u.rate = .95;
        var scene = scenes[current - 1];
        var targets = Array.prototype.slice.call(scene.querySelectorAll('.step:not([hidden])'));
        var highlight = targets[Math.min(i, targets.length - 1)];
        u.onstart = function(){
          if(token!==speechGeneration)return;
          document.querySelectorAll('.narrating').forEach(function(el){el.classList.remove('narrating');});
          if(highlight)highlight.classList.add('narrating');
        };
        u.onend = function(){if(token===speechGeneration){i++;next();}};
        u.onerror = function(){if(highlight)highlight.classList.remove('narrating');};
        speechSynthesis.speak(u);
      } catch(e) {}
    }
    next();
  }

  soundToggle.addEventListener('click', function () {
    soundOn = !soundOn;
    soundToggle.querySelector('.sound-icon').textContent = soundOn ? '🔊' : '🔇';
    soundToggle.setAttribute('aria-pressed', String(soundOn));
    if (introVideo) introVideo.muted = !soundOn;
    if (lab.finish) {
      cancelSpeech(); clearTimeout(lab.timer); lab.speech = false;
      if (!lab.paused) lab.timer = setTimeout(lab.finish, 1800);
    } else if (soundOn) speak(scenes[current - 1].dataset.narasi, sceneLanguage(scenes[current - 1]));
    else cancelSpeech();
  });

  /* ---------- Intro Video & User Form ---------- */
  var intro = document.getElementById('intro');
  var introVideo = document.getElementById('introVideo');
  var heroCard = document.getElementById('heroCard');
  var nameInput = document.getElementById('nameInput');
  var nameError = document.getElementById('nameError');

  function endIntro() {
    if (introVideo) introVideo.pause();
    if (intro) intro.hidden = true;
    if (heroCard) heroCard.hidden = false;
  }

  if (introVideo) {
    introVideo.addEventListener('ended', endIntro);
    introVideo.addEventListener('error', endIntro);
    document.getElementById('skipIntro').addEventListener('click', endIntro);

    introVideo.play().catch(function () {
      introVideo.muted = true;
      introVideo.play().catch(function () {});
    });
  }

  document.getElementById('startForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!nameInput.value.trim()) {
      nameError.hidden = false;
      nameInput.focus();
      return;
    }
    nameError.hidden = true;
    goTo(2);
  });

  nameInput.addEventListener('input', function () { nameError.hidden = true; });

  /* ---------- Scene Navigation ---------- */
  function goTo(num) {
    stopLab();
    scoreFrames.forEach(function(frame,el){cancelAnimationFrame(frame);el.textContent=el.dataset.scoreText;}); scoreFrames.clear();
    scenes.forEach(function (s) { s.classList.remove('is-active'); });
    var el = document.getElementById('s' + num);
    el.classList.add('is-active');
    current = num;
    sceneNum.textContent = String(num);
    progressBar.style.width = (num / TOTAL) * 100 + '%';
    prevBtn.hidden = (num === 1 || num === 11);
    window.scrollTo(0, 0);
    document.querySelector('.progress').setAttribute('aria-valuenow', String(num));
    enterLab(num);
    speak(el.dataset.narasi, sceneLanguage(el));
    var title = el.querySelector('h1,h2');
    if (title) { title.setAttribute('tabindex', '-1'); title.focus({preventScroll:true}); }
  }

  prevBtn.addEventListener('click', function () {
    if (current > 1 && current !== 11) goTo(current - 1);
  });

  /* ---------- Step Revealer ---------- */
  function sceneSteps(scene) {
    return Array.prototype.slice.call(scene.querySelectorAll('.step'));
  }

  function initSteps() {
    scenes.forEach(function (scene) {
      var steps = sceneSteps(scene);
      if (!steps.length) return;
      var groups = [];
      steps.forEach(function (s) {
        var k = parseInt(s.dataset.step, 10);
        if (groups.indexOf(k) < 0) groups.push(k);
      });
      groups.sort(function (a, b) { return a - b; });
      scene.__stepGroups = groups;
      scene.__revealed = 0;
      steps.forEach(function (s) { s.hidden = true; });
      var nav = scene.querySelector('.scene__nav');
      if (nav) nav.hidden = true;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn step-btn';
      btn.textContent = 'Tampilkan Poin Berikutnya ▸';
      btn.addEventListener('click', function () { revealStep(scene); });
      scene.querySelector('.scene__body').appendChild(btn);
    });
  }

  function revealStep(scene) {
    if (scene.__revealed >= scene.__stepGroups.length) return;
    var k = scene.__stepGroups[scene.__revealed];
    scene.querySelectorAll('.step[data-step="' + k + '"]').forEach(function (el) {
      el.hidden = false;
    });
    scene.__revealed++;
    var revealed = scene.querySelector('.step[data-step="' + k + '"]');
    if (revealed) {
      var goal = revealed.closest('.goal-card');
      if(goal)goal.classList.add('demonstrating');
      var text = revealed.querySelector('p');
      if(text && !revealed.classList.contains('quiz')) { stopLab(); speak(text.textContent, text.closest('[lang]').lang === 'en' ? 'en-US' : 'id-ID'); }
    }
    if (scene.__revealed >= scene.__stepGroups.length) {
      var stepBtn = scene.querySelector('.step-btn');
      if (stepBtn) stepBtn.hidden = true;
      var nav = scene.querySelector('.scene__nav');
      if (nav) nav.hidden = false;
    }
  }

  function resetSteps() {
    scenes.forEach(function (scene) {
      var steps = sceneSteps(scene);
      if (!steps.length) return;
      steps.forEach(function (s) { s.hidden = true; });
      scene.__revealed = 0;
      var stepBtn = scene.querySelector('.step-btn');
      if (stepBtn) stepBtn.hidden = false;
      var nav = scene.querySelector('.scene__nav');
      if (nav) nav.hidden = true;
    });
  }

  /* ---------- Quiz Logic ---------- */
  function resetQuiz(quiz) {
    delete quiz.dataset.done;
    delete quiz.dataset.scored;
    delete quiz.dataset.attempted;
    Array.prototype.forEach.call(quiz.querySelectorAll('.opt'), function (o) {
      o.classList.remove('correct', 'wrong', 'selected');
      o.setAttribute('aria-pressed', 'false');
    });
    var fb = quiz.querySelector('.feedback');
    fb.hidden = true;
    fb.className = 'feedback';
    fb.textContent = '';
    var after = quiz.querySelector('.after');
    if (after) after.hidden = true;
  }

  function showOk(quiz, text) {
    var fb = quiz.querySelector('.feedback');
    fb.hidden = false;
    fb.className = 'feedback is-ok';
    fb.textContent = '✓ Correct Answer! ' + text;
  }

  function showErr(quiz) {
    quiz.dataset.missed = '1';
    var fb = quiz.querySelector('.feedback');
    fb.hidden = false;
    fb.className = 'feedback is-err';
    fb.innerHTML = '<p>✕ Please Try Again. Review the lesson and try once more.</p>' +
      '<button class="btn btn--secondary btn--retry" type="button" style="margin-top:0.5rem; padding:0.35rem 0.8rem; font-size:0.85rem;">Try Again</button>';
  }

  function onCorrect(quiz) {
    quiz.dataset.done = '1';
    var after = quiz.querySelector('.after');
    if (after) after.hidden = false;
    showOk(quiz, quiz.dataset.pembahasan || 'Correct Answer!');
    if (quiz.closest('#s11')) evalCorrect(quiz);
  }

  function judgeSingle(quiz, btn) {
    var opts = Array.prototype.slice.call(quiz.querySelectorAll('.opt'));
    var idx = opts.indexOf(btn);
    btn.setAttribute('aria-pressed', 'true');
    if (idx === parseInt(quiz.dataset.jawaban, 10)) {
      btn.classList.add('correct');
      onCorrect(quiz);
    } else {
      btn.classList.add('wrong');
      quiz.dataset.attempted = '1';
      showErr(quiz);
    }
  }

  function judgeMulti(quiz) {
    var want = quiz.dataset.multi.split(',').map(function (s) { return parseInt(s, 10); });
    var opts = Array.prototype.slice.call(quiz.querySelectorAll('.opt'));
    var got = [];
    opts.forEach(function (o, i) { if (o.classList.contains('selected')) got.push(i); });
    var ok = got.length === want.length && want.every(function (i) { return got.indexOf(i) >= 0; });
    if (ok) {
      opts.forEach(function (o, i) {
        o.classList.remove('selected');
        if (want.indexOf(i) >= 0) o.classList.add('correct');
      });
      onCorrect(quiz);
    } else {
      showErr(quiz);
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;

    var retry = t.closest('.btn--retry');
    if (retry) { resetQuiz(retry.closest('.quiz')); return; }

    var gotoBtn = t.closest('[data-goto]');
    if (gotoBtn) {
      var v = gotoBtn.dataset.goto;
      if (v === 'restart') restartAll();
      else goTo(parseInt(v.substring(1), 10));
      return;
    }

    var check = t.closest('.btn-check');
    if (check) { var checkedQuiz = check.closest('.quiz'); if (!checkedQuiz.dataset.done) judgeMulti(checkedQuiz); return; }

    var opt = t.closest('.opt');
    if (opt && !opt.closest('.quiz').dataset.done && !opt.closest('.quiz').dataset.attempted) {
      var quiz = opt.closest('.quiz');
      if (quiz.dataset.multi) {
        opt.classList.toggle('selected');
        opt.setAttribute('aria-pressed', String(opt.classList.contains('selected')));
      } else {
        judgeSingle(quiz, opt);
      }
      return;
    }
  });

  /* ---------- Evaluation Management ---------- */
  function updateEvalStatus() {
    var done = evalQuizzes.filter(function (q) { return q.dataset.done; }).length;
    evalStatus.textContent = 'Question ' + Math.min(done + 1, evalQuizzes.length) +
      '/' + evalQuizzes.length + ' · Current Score: ' + evalScore;
    var track = document.querySelector('.evaluation-track');
    if(track){track.setAttribute('aria-valuenow',String(done));track.querySelector('div').style.width=(done/evalQuizzes.length*100)+'%';}
  }

  function evalCorrect(quiz) {
    if (!quiz.dataset.scored) {
      quiz.dataset.scored = '1';
      if (!quiz.dataset.missed) evalScore++;
    }
    var i = evalQuizzes.indexOf(quiz);
    if (i < evalQuizzes.length - 1) {
      evalQuizzes[i + 1].hidden = false;
      updateEvalStatus();
    } else {
      lastScore = evalScore;
      animateScore(evalScoreEl, evalScore);
      evalComment.textContent = evalScore === 5 ? 'Congratulations! You understand all the room service procedures.'
        : evalScore >= 3 ? 'Good work! You understand the basic procedures.'
        : 'Review the lessons and try again to build your understanding.';
      evalResult.hidden = false;
      updateEvalStatus();
      evalStatus.textContent = 'Evaluation Complete · Your Final Score: ' + evalScore;
      finalBadge.textContent = 'Your Final Score: ' + evalScore + '/' + evalQuizzes.length;
      finalBadge.hidden = false;
    }
  }

  function resetEval() {
    evalScore = 0; lastScore = null; finalBadge.hidden = true;
    if(scoreFrames.has(evalScoreEl)){cancelAnimationFrame(scoreFrames.get(evalScoreEl));scoreFrames.delete(evalScoreEl);}
    evalQuizzes.forEach(function (q, i) {
      resetQuiz(q);
      delete q.dataset.missed;
      q.hidden = i > 0;
    });
    evalResult.hidden = true;
    updateEvalStatus();
  }

  document.getElementById('evalReset').addEventListener('click', resetEval);

  /* ---------- Restart & Finish ---------- */
  function restartAll() {
    stopLab();
    document.querySelectorAll('.quiz').forEach(function(q){resetQuiz(q); delete q.dataset.missed;});
    document.querySelectorAll('.learning-lab').forEach(function(p){if(p.__reset)p.__reset();p.classList.remove('celebrating');});
    resetEval();
    lastScore = null;
    finalBadge.hidden = true;
    s12.classList.remove('is-finished');
    s12.querySelector('.done-card').hidden = true;
    resetSteps();
    goTo(1);
  }

  document.getElementById('doneBtn').addEventListener('click', function () {
    stopLab();
    celebrate();
    s12.classList.add('is-finished');
    s12.querySelector('.done-card').hidden = false;
  });

  /* ---------- Illustrated learning lab: one active timeline per scene ---------- */
  var lab = { timer: null, finish: null, paused: false, run: 0, speech: false };
  var simulations = {};
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var practiceOrder = { room: '305', items: [0, 0, 0], request: 'No special requests' };
  var menu = [['Fried rice', 'meal'], ['Tea', 'tea'], ['Orange juice', 'juice']];

  function staff(guest) {
    return '<svg class="person ' + (guest ? 'person--guest' : 'person--staff') + '" viewBox="0 0 140 160" aria-hidden="true"><ellipse cx="70" cy="150" rx="48" ry="7" fill="#d7dfed"/><path d="M45 139v-28h50v28" fill="#25375c"/><path d="M41 110V85q0-20 29-20t29 20v25" fill="' + (guest ? '#f5ad52' : '#7056ba') + '"/><path d="m60 69 10 14 10-14" fill="white"/><rect x="79" y="86" width="14" height="8" rx="2" fill="#ffdb83"/><g class="wave-arm"><path d="m97 88 18-18 4-25" fill="none" stroke="#db9a70" stroke-width="12" stroke-linecap="round"/><circle cx="119" cy="40" r="8" fill="#db9a70"/></g><path d="M43 86 30 110" stroke="#db9a70" stroke-width="12" stroke-linecap="round"/><rect x="60" y="53" width="20" height="20" rx="7" fill="#db9a70"/><circle cx="70" cy="36" r="27" fill="#efb58d"/><path d="M44 33Q38 2 70 5q30 0 27 30L84 19Q65 31 44 25" fill="#293553"/><circle cx="60" cy="37" r="2.5" fill="#293553"/><circle cx="80" cy="37" r="2.5" fill="#293553"/><path d="M60 48q10 12 20 0" fill="white" stroke="#a45b4d" stroke-width="2"/><path d="M51 142v7m38-7v7" stroke="#25375c" stroke-width="15" stroke-linecap="round"/></svg>';
  }
  function object(kind) {
    var art = {
      phone: '<rect x="16" y="45" width="88" height="42" rx="15" fill="#7056ba"/><g class="receiver"><path d="M23 43q37-35 74 0" fill="none" stroke="#354967" stroke-width="15" stroke-linecap="round"/></g><g fill="white"><circle cx="48" cy="61" r="3"/><circle cx="60" cy="61" r="3"/><circle cx="72" cy="61" r="3"/><circle cx="48" cy="73" r="3"/><circle cx="60" cy="73" r="3"/><circle cx="72" cy="73" r="3"/></g><path class="ring-lines" d="M10 20 2 32m108-12 8 12" stroke="#cf8b24" stroke-width="5"/>',
      meal: '<ellipse cx="60" cy="75" rx="49" ry="19" fill="white" stroke="#768fa9" stroke-width="3"/><path d="M23 70q2-43 37-43t37 43" fill="#f9c969"/><g fill="#81a75b"><circle cx="43" cy="48" r="5"/><circle cx="74" cy="57" r="5"/><circle cx="54" cy="64" r="4"/></g><ellipse cx="65" cy="43" rx="17" ry="11" fill="white"/><circle cx="65" cy="43" r="6" fill="#ffb547"/>',
      tea: '<path d="M81 42h14q22 23-11 29" fill="none" stroke="#7056ba" stroke-width="7"/><path d="M25 37h60v34q-30 28-60 0z" fill="#b9dfe9"/><ellipse cx="55" cy="38" rx="30" ry="8" fill="#b57e43"/><path class="steam" d="M42 27q-10-10 0-20m22 20q-10-10 0-20" stroke="#768fa9" stroke-width="4" fill="none"/><path d="M17 86h80" stroke="#7056ba" stroke-width="5"/>',
      juice: '<path d="m35 30 7 60h40l7-60z" fill="#ffb547" stroke="#b87920" stroke-width="3"/><path d="m64 75 5-63h24" fill="none" stroke="#7056ba" stroke-width="5"/><circle cx="87" cy="33" r="15" fill="#ffd780" stroke="#e8962e" stroke-width="4"/>',
      form: '<rect x="25" y="12" width="70" height="85" rx="8" fill="white" stroke="#768fa9" stroke-width="3"/><rect x="44" y="7" width="32" height="13" rx="4" fill="#7056ba"/><g class="write-lines" stroke="#7056ba" stroke-width="5"><path d="M39 37h42m-42 18h42m-42 18h25"/></g>',
      check: '<circle cx="60" cy="52" r="40" fill="#d6f2e8"/><path class="check-stroke" d="m35 52 17 18 33-37" fill="none" stroke="#14795c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
      clock: '<circle cx="60" cy="52" r="40" fill="white" stroke="#7056ba" stroke-width="6"/><path d="M60 19v7m33 26h-7M60 85v-7M27 52h7" stroke="#768fa9" stroke-width="3"/><path class="clock-hand" d="M60 52V30" stroke="#7056ba" stroke-width="5" stroke-linecap="round"/><path d="m60 52 17 10" stroke="#354967" stroke-width="4"/>',
      trolley: '<path d="M14 32h12v47h75M26 48h70v31" fill="none" stroke="#7056ba" stroke-width="6"/><path d="M37 44q0-25 26-25t26 25z" fill="#a9d6de"/><circle cx="63" cy="15" r="5" fill="#7056ba"/><circle cx="38" cy="89" r="8" fill="#354967"/><circle cx="89" cy="89" r="8" fill="#354967"/>',
      kitchen: '<rect x="15" y="45" width="90" height="48" rx="7" fill="#a9d6de"/><rect x="29" y="60" width="62" height="24" rx="4" fill="#354967"/><path d="M30 40h60l-7-18H37z" fill="#7056ba"/><path class="steam" d="M50 19q-9-9 0-17m22 17q-9-9 0-17" fill="none" stroke="#768fa9" stroke-width="3"/>'
    };
    return '<svg class="prop prop--' + kind + '" viewBox="0 0 120 105" aria-hidden="true">' + (art[kind] || art.form) + '</svg>';
  }
  function button(action, label, extra) {
    return '<button type="button" class="btn btn--secondary" data-lab="' + action + '" ' + (extra || '') + '>' + label + '</button>';
  }
  function panel(n, title, html) {
    var el = document.createElement('div');
    el.className = 'learning-lab'; el.dataset.labScene = n;
    el.lang = n >= 4 && n <= 10 ? 'en' : 'id';
    el.innerHTML = '<div class="lab-heading"><span class="lab-kicker">LAB / ' + String(n).padStart(2, '0') + '</span><h3>' + title + '</h3></div>' + html;
    document.querySelector('#s' + n + ' .scene__body').prepend(el);
    return el;
  }
  function controls(language) {
    if (language === 'id') return '<div class="lab-controls">' + button('play', '▶ Putar demonstrasi') + button('pause', 'Ⅱ Jeda') + button('replay', '↻ Ulangi') + '</div>';
    return '<div class="lab-controls">' + button('play', '▶ Play Demonstration') + button('pause', 'Ⅱ Pause') + button('replay', '↻ Replay') + '</div>';
  }
  function stopLab() {
    lab.run++; clearTimeout(lab.timer); lab.timer = null; lab.finish = null; lab.paused = false;
    cancelSpeech();
    document.querySelectorAll('.learning-lab').forEach(function (p) { p.classList.remove('is-playing', 'is-paused', 'is-ringing'); });
  }
  // Speech end events drive the visual sequence; a timer is used only without narration.
  function runSequence(p, steps, start) {
    stopLab();
    var token = lab.run, index = start || 0;
    p.classList.add('is-playing');
    function advance() {
      if (token !== lab.run) return;
      if (index >= steps.length) { p.classList.remove('is-playing'); lab.finish = null; return; }
      var step = steps[index];
      p.dataset.frame = index;
      step.draw();
      var ended = false;
      function next() {
        if (ended || token !== lab.run) return;
        ended = true; lab.finish = null; index++; advance();
      }
      lab.finish = next;
      if (soundOn && 'speechSynthesis' in window) {
        var u = new SpeechSynthesisUtterance(step.text);
        applySpeechLanguage(u, p.lang === 'en' ? 'en-US' : 'id-ID'); u.rate = .95;
        u.onend = next; u.onerror = function () { if (token === lab.run) { lab.speech = false; if (!lab.paused) lab.timer = setTimeout(next, 1200); } };
        lab.speech = true;
        speechSynthesis.speak(u);
      } else { lab.speech = false; lab.timer = setTimeout(next, 3000); }
    }
    advance();
  }
  function dialogue(p, text, who) {
    p.querySelector('.lab-dialogue').textContent = text;
    p.dataset.speaker = who || 'staff';
  }
  function stagePair() { return '<div class="lab-actors"><div class="actor staff-actor">' + staff(false) + '<span>Andi · Room Service</span></div><div class="call-object">' + object('phone') + '<div class="sound-waves" aria-hidden="true"><i></i><i></i><i></i></div></div><div class="actor guest-actor">' + staff(true) + '<span>Alexander · Room 305</span></div></div><p class="lab-dialogue" role="status">Select Play to watch the procedure.</p>'; }

  function initLabs() {
    var welcome = document.createElement('div'); welcome.className = 'welcome-staff';
    welcome.innerHTML = staff(false) + '<p>Selamat datang! Saya Andi, teman praktik room service kamu.</p>';
    heroCard.prepend(welcome);

    var goals = ['phone', 'form', 'check', 'staff'];
    document.querySelectorAll('.goal-card').forEach(function (g, i) {
      var visual = document.createElement('div'); visual.className = 'goal-visual';
      visual.innerHTML = (i === 3 ? staff(false) : object(goals[i])) + button('goal', '↻ Peragakan lagi');
      g.prepend(visual);
      visual.querySelector('button').addEventListener('click', function () {
        g.classList.remove('demonstrating'); void g.offsetWidth; g.classList.add('demonstrating');
        speak(g.querySelector('p').textContent);
      });
    });
    buildWorkflow(3, true);
    buildTelephone();
    var id = panel(5, 'Ask → Record → Verify', stagePair() + '<div class="guest-form"><label>Guest name<input readonly aria-label="Verified guest name" value=""></label><label>Room number<input readonly aria-label="Verified room number" value=""></label><span class="verification" role="status"></span></div>' + controls());
    simulations[5] = function () {
      var fields = id.querySelectorAll('input'); fields.forEach(function (f) { f.value = ''; f.classList.remove('field-entered'); }); id.querySelector('.verification').textContent = '';
      runSequence(id, [
        {text:'May I have your name and room number, please?',draw:function(){dialogue(id,'Andi: May I have your name and room number, please?');}},
        {text:'My name is Alexander. I am in room 305.',draw:function(){dialogue(id,'Guest: My name is Alexander. I am in room 305.','guest');fields[0].value='Alexander';fields[0].classList.add('field-entered');}},
        {text:'That is Mr Alexander in room 305. Is that correct?',draw:function(){fields[1].value='305';fields[1].classList.add('field-entered');dialogue(id,'Andi: That is Mr Alexander in room 305. Is that correct?');}},
        {text:'That is correct. The guest details have been confirmed.',draw:function(){dialogue(id,'Guest: That is correct, thank you.','guest');id.querySelector('.verification').innerHTML=object('check')+'Guest details verified';}}
      ]);
    };
    id.__reset=function(){id.querySelectorAll('input').forEach(function(f){f.value='';f.classList.remove('field-entered');});id.querySelector('.verification').textContent='';dialogue(id,'Select Play to watch the procedure.');};
    buildOrder();
    var repeat = panel(7, 'Read Back Every Detail', stagePair() + '<ul class="readback-list"></ul>' + controls());
    repeat.__reset=function(){repeat.querySelector('ul').replaceChildren();dialogue(repeat,'Select Play to watch the procedure.');};
    simulations[7] = function () {
      var items = practiceOrder.items.some(Boolean) ? practiceOrder.items : [2,1,0];
      var lines = menu.map(function(m,i){return items[i] ? items[i]+' × '+m[0] : null;}).filter(Boolean);
      lines.push('Room '+practiceOrder.room, 'Special request: '+practiceOrder.request, 'Estimated delivery time: 20 minutes');
      var list = repeat.querySelector('ul'); list.replaceChildren();
      lines.forEach(function(t){var li=document.createElement('li');li.textContent=t;list.appendChild(li);});
      var steps = lines.map(function(t,i){return {text:t,draw:function(){list.querySelectorAll('li').forEach(function(li,j){li.classList.toggle('reading',j===i);li.classList.toggle('checked',j<i);});dialogue(repeat,'Andi: '+t);}};});
      steps.push({text:'Yes, that is my order. Thank you.',draw:function(){list.querySelectorAll('li').forEach(function(li){li.classList.remove('reading');li.classList.add('checked');});dialogue(repeat,'✓ Guest: Yes, that is my order. Thank you.','guest');}});
      runSequence(repeat,steps);
    };
    var closing = panel(8, 'Give the Delivery Time, Then Close Politely', stagePair() + '<div class="delivery-clock">' + object('clock') + '<strong>± 20 minutes</strong><span>Example delivery estimate</span></div>' + controls());
    closing.__reset=function(){closing.classList.remove('call-ended');dialogue(closing,'Select Play to watch the procedure.');};
    simulations[8] = function () {
      closing.classList.remove('call-ended');
      runSequence(closing,[
        {text:'Thank you, Mr Alexander. Your order will be delivered in approximately twenty minutes.',draw:function(){dialogue(closing,'Andi: Thank you. Your order will arrive in approximately 20 minutes.');}},
        {text:'All right, thank you for letting me know.',draw:function(){dialogue(closing,'Guest: All right, thank you for letting me know.','guest');}},
        {text:'Have a pleasant afternoon. Let the guest end the call, then gently replace the receiver.',draw:function(){dialogue(closing,'The guest has ended the call. Andi gently replaces the receiver.');closing.classList.add('call-ended');}}
      ]);
    };
    buildChanges(); buildWorkflow(10, false);
    var evalHeader = document.querySelector('.eval-header-card');
    evalHeader.insertAdjacentHTML('beforeend','<div class="evaluation-track" role="progressbar" aria-label="Evaluation progress" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0"><div></div></div>');
    var complete = panel(12, 'Selamat!', '<div class="completion-stage">'+staff(false)+'<div><strong class="completion-greeting"></strong><p>Kamu telah mempelajari proses layanan dari telepon hingga pengantaran.</p><p class="completion-score" lang="en"></p></div><div class="confetti" aria-hidden="true">'+Array.from({length:18},function(_,i){return '<i style="--i:'+i+'"></i>';}).join('')+'</div></div>'+button('celebrate','↻ Rayakan lagi'));
    complete.querySelector('[data-lab="celebrate"]').addEventListener('click',celebrate);
    document.querySelectorAll('.scene[data-narasi]').forEach(function(scene){
      if(scene.id==='s11')return;
      var nav = document.createElement('div'); nav.className='narration-controls';
      nav.innerHTML=button('narrate','▶ Narasi materi')+button('narration-pause','Ⅱ Jeda narasi')+button('narration-replay','↻ Ulangi narasi');
      scene.querySelector('.scene__head').after(nav);
    });
  }

  function buildTelephone() {
    var p = panel(4,'Answer Before the Third Ring',stagePair()+'<p class="ring-counter" role="status">Ring <strong>0</strong>/3</p><div class="lab-controls">'+button('answer','☎ Answer the Phone')+button('play','▶ Play Conversation')+button('pause','Ⅱ Pause Conversation')+button('replay','↻ Replay Conversation')+'</div>');
    p.__answered=false;
    function ringing(){
      stopLab();p.__answered=false;p.__rings=1;p.classList.add('is-ringing');p.querySelector('.ring-counter strong').textContent='1';
      dialogue(p,'The telephone is ringing. Answer Before the Third Ring.');
      var token=lab.run;
      function ring(){if(token!==lab.run||p.__answered)return;p.__rings++;p.querySelector('.ring-counter strong').textContent=p.__rings;
        if(p.__rings===3){p.classList.remove('is-ringing');dialogue(p,'The third ring has sounded. Replay and try to answer sooner.');return;}
        lab.timer=setTimeout(ring,2200);
      }
      lab.timer=setTimeout(ring,2200);
    }
    p.__ring=ringing;
    simulations[4]=function(){
      if(!p.__answered){dialogue(p,'Answer the phone first. Select Replay to start a new call.');return;}
      runSequence(p,[
        {text:'Good afternoon, Room Service. This is Andi speaking. How may I assist you?',draw:function(){dialogue(p,'Andi: Good afternoon, Room Service. This is Andi speaking. How may I assist you?');}},
        {text:'Good afternoon. I would like to order lunch for room 305, please.',draw:function(){dialogue(p,'Guest: Good afternoon. I would like to order lunch for room 305, please.','guest');}},
        {text:'Certainly. May I confirm your name first, please?',draw:function(){dialogue(p,'Andi: Certainly. May I confirm your name first, please?');}}
      ]);
    };
    p.querySelector('[data-lab="answer"]').addEventListener('click',function(){
      if(p.__answered)return;
      if(p.__rings>=3){dialogue(p,'The ring limit has been reached. Select Replay Conversation to try again.');return;}
      clearTimeout(lab.timer);p.__answered=true;p.classList.remove('is-ringing');
      p.querySelector('.ring-counter').firstChild.textContent='✓ Answered on ring ';
      simulations[4]();
    });
  }

  function buildOrder() {
    var p=panel(6,'Practice Taking an Order','<div class="order-desk"><div><p class="lab-kicker">IN-ROOM DINING MENU</p><div class="illustrated-menu">'+menu.map(function(m,i){return button('add',object(m[1])+'<span>'+m[0]+'</span><small>+ Add Item</small>','data-item="'+i+'"');}).join('')+'</div></div><form class="order-sheet"><h4>Order ticket</h4><label>Room number<input id="orderRoom" inputmode="numeric" pattern="[0-9]{1,4}" maxlength="4" value="305" required></label><div class="order-lines"></div><label>Special requests<select id="orderRequest"><option>No special requests</option><option>No sugar</option><option>No ice</option><option>No sugar and no ice</option></select></label><button class="btn btn--primary" type="submit">✓ Check Summary</button><p class="order-summary" role="status"></p></form></div><span class="flying-item" aria-hidden="true">'+object('form')+'</span>');
    function render(){
      var target=p.querySelector('.order-lines');target.replaceChildren();
      menu.forEach(function(m,i){if(!practiceOrder.items[i])return;var row=document.createElement('label');row.className='order-row';row.textContent=m[0];var input=document.createElement('input');input.type='number';input.required=true;input.min=0;input.max=20;input.value=practiceOrder.items[i];input.setAttribute('aria-label','Quantity '+m[0]);input.addEventListener('input',function(){var n=Number(input.value);if(!Number.isInteger(n)||n<0||n>20){input.setCustomValidity('Enter a quantity from 0 to 20.');return;}input.setCustomValidity('');practiceOrder.items[i]=n;p.querySelector('.order-summary').textContent='The order has changed. Please check the summary again.';});row.append(input);target.append(row);});
      if(!practiceOrder.items.some(Boolean))target.textContent='Select food or drinks from the menu.';
    }
    p.querySelectorAll('[data-lab="add"]').forEach(function(b){b.addEventListener('click',function(){var i=Number(b.dataset.item);practiceOrder.items[i]=Math.min(20,practiceOrder.items[i]+1);render();p.querySelector('.order-summary').textContent='Recorded: '+menu[i][0];p.classList.remove('item-moving');void p.offsetWidth;p.classList.add('item-moving');});});
    p.querySelector('form').addEventListener('submit',function(e){e.preventDefault();if(!practiceOrder.items.some(Boolean)){p.querySelector('.order-summary').textContent='Please add at least one item first.';return;}practiceOrder.room=p.querySelector('#orderRoom').value;practiceOrder.request=p.querySelector('#orderRequest').value;p.querySelector('.order-summary').textContent='✓ Room '+practiceOrder.room+' · '+menu.map(function(m,i){return practiceOrder.items[i]?practiceOrder.items[i]+' × '+m[0]:'';}).filter(Boolean).join(', ')+' · '+practiceOrder.request+'. Ready to read back to the guest.';});
    p.querySelectorAll('input,select').forEach(function(el){el.addEventListener('input',function(){p.querySelector('.order-summary').textContent='The order has changed. Please check the summary again.';});});
    p.__reset=function(){p.querySelector('form').reset();practiceOrder={room:'305',items:[0,0,0],request:'No special requests'};render();p.querySelector('.order-summary').textContent='';};render();
  }

  function buildChanges(){
    var p=panel(9,'Revise the Order Without Missing Any Details','<div class="change-comparison"><div class="before-order"><span class="lab-kicker">BEFORE · ROOM 305</span>'+object('meal')+'<p><strong>2</strong> portions of fried rice</p><p>1 tea <span>with sugar</span></p></div><div class="after-order"><span class="lab-kicker">AFTER · ROOM 305</span>'+object('tea')+'<p><strong class="new-quantity">2</strong> portions of fried rice</p><p>1 tea <span class="sugar-request">with sugar</span><span class="sugar-cube" aria-hidden="true">◻</span></p></div></div><p class="lab-dialogue" role="status">The guest requests 3 portions and tea without sugar. Apply each change in turn.</p><div class="lab-controls">'+button('quantity','1. Change to 3 Portions')+button('sugar','2. Remove Sugar')+button('confirm-change','3. Confirm & Send')+button('reset-change','↻ Replay')+'</div><div class="kitchen-dispatch"><span class="dispatch-ticket">'+object('form')+'</span>'+object('kitchen')+'<span class="dispatch-status" role="status"></span></div>');
    var quantity=false,sugar=false,sent=false;
    p.__reset=function(){quantity=sugar=sent=false;p.classList.remove('quantity-changed','sugar-removed','sent');p.querySelector('.new-quantity').textContent='2';p.querySelector('.sugar-request').textContent='with sugar';p.querySelector('.dispatch-status').textContent='';dialogue(p,'The guest requests 3 portions and tea without sugar. Apply each change in turn.');p.querySelectorAll('button').forEach(function(b){b.disabled=false;});};
    p.querySelector('[data-lab="quantity"]').addEventListener('click',function(){quantity=true;p.classList.add('quantity-changed');p.querySelector('.new-quantity').textContent='3';dialogue(p,'Quantity updated: 2 → 3 portions.');this.disabled=true;});
    p.querySelector('[data-lab="sugar"]').addEventListener('click',function(){sugar=true;p.classList.add('sugar-removed');p.querySelector('.sugar-request').textContent='without sugar';dialogue(p,'Special request updated: tea without sugar.');this.disabled=true;});
    p.querySelector('[data-lab="confirm-change"]').addEventListener('click',function(){if(!quantity||!sugar){dialogue(p,'Apply both changes first.');return;}if(sent)return;sent=true;this.disabled=true;runSequence(p,[{text:'Certainly. That is three portions and one cup of tea without sugar for room 305. Is that correct?',draw:function(){dialogue(p,'Andi: Certainly. That is three portions and one cup of tea without sugar for room 305. Is that correct?');}},{text:'That is correct, thank you.',draw:function(){dialogue(p,'✓ Guest: That is correct, thank you.','guest');}},{text:'Thank you. I will send the updated order to the kitchen now.',draw:function(){dialogue(p,'Andi: Thank you. I will send the updated order to the kitchen now.');p.classList.add('sent');p.querySelector('.dispatch-status').textContent='✓ The kitchen received the revised ticket: 3 portions · 1 tea without sugar · room 305.';}}]);});
    p.querySelector('[data-lab="reset-change"]').addEventListener('click',function(){stopLab();p.__reset();});
  }

  function buildWorkflow(n,mini){
    var labels=mini?['Tamu bersantai','Tamu menelepon','Petugas mencatat','Dapur memasak','Waiter mengantar','Tamu menerima']:['Guest','Order Taker','Kitchen','Delivery Staff','Guest receives the meal'];
    var kinds=mini?['guest','phone','staff','kitchen','trolley','meal']:['guest','staff','kitchen','trolley','meal'];
    var texts=mini?['Tamu bersantai di kamar hotel dan ingin menikmati makanan tanpa keluar kamar.','Tamu menghubungi room service melalui telepon.','Petugas menerima telepon, mencatat identitas dan pesanan, lalu mengonfirmasi.','Dapur menerima tiket dan menyiapkan hidangan sesuai permintaan.','Waiter memeriksa pesanan dan mendorong troli menuju kamar tamu.','Tamu menerima hidangan yang sesuai dengan pesanan.']:['The guest provides their name, room number, menu choices, quantities, and special requests.','The order taker records and reads back the order, prepares the bill, and sends the ticket to the kitchen.','Kitchen staff prepare the meal according to the ticket and check all special requests.','The waiter checks the ticket, sets up the trolley, and delivers the meal to the correct room.','The guest receives the meal. Staff check that the order is complete and correct.'];
    function vignette(kind) {
      var room = '<svg class="room-backdrop" viewBox="0 0 160 120" aria-hidden="true"><rect x="1" y="1" width="158" height="118" rx="10" fill="#e6f2f6"/><path d="M0 96h160" stroke="#c1d4dd" stroke-width="2"/><rect x="12" y="10" width="48" height="42" rx="4" fill="#a4d5ed" stroke="white" stroke-width="5"/><path d="M36 10v42M12 31h48" stroke="white" stroke-width="3"/><path d="M14 79q0-16 15-16h22q15 0 15 16v20H14z" fill="#c3acd9"/><rect x="21" y="84" width="39" height="12" rx="4" fill="#ab8cc9"/><rect x="117" y="19" width="29" height="70" rx="3" fill="#c8b69c"/><circle cx="138" cy="55" r="2" fill="#7056ba"/></svg>';
      if(kind==='guest') return '<div class="workflow-vignette room-vignette">'+room+staff(true)+'</div>';
      if(kind==='staff') return '<div class="workflow-vignette desk-vignette">'+staff(false)+object('form')+'<span class="service-desk" aria-hidden="true"></span></div>';
      if(kind==='kitchen') return '<div class="workflow-vignette chef-vignette">'+staff(false)+'<svg class="chef-hat" viewBox="0 0 60 40" aria-hidden="true"><path d="M12 20C-3 10 10-4 22 6 29-5 43-1 44 7 60-1 67 18 48 22v14H12z" fill="white" stroke="#768fa9" stroke-width="2"/></svg>'+object('kitchen')+'</div>';
      if(kind==='trolley') return '<div class="workflow-vignette delivery-vignette">'+staff(false)+object('trolley')+'</div>';
      if(kind==='meal') return '<div class="workflow-vignette meal-vignette">'+room+staff(true)+object('meal')+'</div>';
      return '<div class="workflow-vignette room-vignette">'+room+staff(true)+object('phone')+'</div>';
    }
    var hint = mini ? 'Klik setiap tahap atau putar seluruh alur.' : 'Select a stage or play the complete workflow.';
    var p=panel(n,mini?'Satu pesanan, satu perjalanan pelayanan':'Follow the Ticket from the Call to the Room','<div class="hotel-workflow '+(mini?'hotel-mini':'')+'">'+labels.map(function(t,i){return '<div class="flow-stop">'+button('stage',vignette(kinds[i])+'<span>'+t+'</span>','data-stage="'+i+'" aria-pressed="false"')+'<span class="travel-ticket" aria-hidden="true">'+object('form')+'</span></div>';}).join('')+'</div><p class="lab-dialogue" role="status">'+hint+'</p>'+controls(mini ? 'id' : 'en'));
    p.__reset=function(){p.querySelectorAll('.flow-stop').forEach(function(el){el.classList.remove('current-stop','visited-stop');el.querySelector('button').setAttribute('aria-pressed','false');});dialogue(p,hint);};
    function draw(i){p.querySelectorAll('.flow-stop').forEach(function(el,j){el.classList.toggle('current-stop',j===i);el.classList.toggle('visited-stop',j<i);el.querySelector('button').setAttribute('aria-pressed',String(j===i));});dialogue(p,texts[i]);}
    simulations[n]=function(){runSequence(p,texts.map(function(t,i){return {text:t,draw:function(){draw(i);}};}));};
    p.querySelectorAll('[data-stage]').forEach(function(b){b.addEventListener('click',function(){var i=Number(b.dataset.stage);runSequence(p,[{text:texts[i],draw:function(){draw(i);}}]);});});
  }

  function celebrate(){
    var p=document.querySelector('[data-lab-scene="12"]');
    p.querySelector('.completion-greeting').textContent='Selamat, '+(nameInput.value.trim()||'teman belajar')+'!';
    var score=p.querySelector('.completion-score');
    score.textContent=lastScore===null?'Selesaikan evaluasi akhir untuk melihat skor kamu.':'Your Final Score: '+lastScore+'/'+evalQuizzes.length;
    if(lastScore!==null)animateScore(score,lastScore,'Your Final Score: ');
    p.classList.remove('celebrating');void p.offsetWidth;p.classList.add('celebrating');
  }
  var scoreFrames = new Map();
  function animateScore(el,value,prefix){
    el.dataset.scoreText=(prefix||'')+value+'/'+evalQuizzes.length;
    if(scoreFrames.has(el))cancelAnimationFrame(scoreFrames.get(el));
    if(reducedMotion.matches){el.textContent=(prefix||'')+value+'/'+evalQuizzes.length;return;}
    var start=performance.now();
    function tick(now){var f=Math.min(1,(now-start)/850);el.textContent=(prefix||'')+Math.round(value*f)+'/'+evalQuizzes.length;if(f<1)scoreFrames.set(el,requestAnimationFrame(tick));else scoreFrames.delete(el);}
    scoreFrames.set(el,requestAnimationFrame(tick));
  }
  function enterLab(n){
    if(n===4){var p=document.querySelector('[data-lab-scene="4"]');p.__ring();}
    if(n===12)celebrate();
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-lab]');if(!b)return;
    var action=b.dataset.lab, scene=b.closest('.scene'), p=b.closest('.learning-lab');
    if(action==='narrate'||action==='narration-replay'){stopLab();speak(scene.dataset.narasi, sceneLanguage(scene));}
    if(action==='narration-pause'){
      if(lab.finish){var active=scene.querySelector('.learning-lab.is-playing');if(active)active.querySelector('[data-lab="pause"]')?.click();}
      else {try{if(speechSynthesis.paused)speechSynthesis.resume();else speechSynthesis.pause();}catch(err){}}
    }
    if(!p)return;
    var n=Number(p.dataset.labScene);
    if(action==='play'){
      if(p.classList.contains('is-paused')){lab.paused=false;p.classList.remove('is-paused');if(lab.speech&&soundOn)speechSynthesis.resume();else if(lab.finish)lab.timer=setTimeout(lab.finish,1800);}
      else if(simulations[n])simulations[n]();
    }
    if(action==='replay'){if(n===4){p.querySelector('.ring-counter').firstChild.textContent='Ring ';p.__ring();}else if(simulations[n])simulations[n]();}
    if(action==='pause'&&p.classList.contains('is-playing')){lab.paused=!lab.paused;p.classList.toggle('is-paused',lab.paused);if(lab.paused){clearTimeout(lab.timer);if(lab.speech)speechSynthesis.pause();}else{if(lab.speech&&soundOn)speechSynthesis.resume();else if(lab.finish)lab.timer=setTimeout(lab.finish,1800);}}
  });

  document.addEventListener('visibilitychange', function(){
    if(document.hidden)stopLab();
  });

  /* ---------- Initialization ---------- */
  initLabs();
  document.querySelectorAll('.feedback').forEach(function(f){f.setAttribute('role','status');});
  document.querySelectorAll('.opt').forEach(function(o){o.setAttribute('aria-pressed','false');});
  initSteps();
  resetEval();
  goTo(1);
})();