(() => {
  'use strict';

  const stage = document.querySelector('#hero-3d');
  const canvas = document.querySelector('#hero-canvas');
  const panel = document.querySelector('#mascot-chat-panel');
  const close = document.querySelector('#mascot-chat-close');
  const form = document.querySelector('#mascot-chat-form');
  const input = document.querySelector('#mascot-chat-input');
  const log = document.querySelector('#mascot-chat-log');
  const speech = document.querySelector('#mascot-speech');
  if (!stage || !canvas || !panel || !form || !input || !log) return;

  let character = { greet() {}, listen() {}, answer() {}, setOpen() {}, replay() {}, hitTest: () => false };
  let pendingAnswer = false;
  panel.inert = true;
  let lastFocused = null;

  const openChat = () => {
    if (stage.classList.contains('chat-open')) return;
    lastFocused = document.activeElement;
    stage.classList.add('chat-open');
    panel.setAttribute('aria-hidden', 'false');
    panel.inert = false;
    character.setOpen(true);
    canvas.setAttribute('aria-expanded', 'true');
    speech?.setAttribute('aria-expanded', 'true');
    character.greet();
    window.setTimeout(() => input.focus({ preventScroll: true }), 120);
  };

  const closeChat = () => {
    stage.classList.remove('chat-open');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    character.setOpen(false);
    canvas.setAttribute('aria-expanded', 'false');
    speech?.setAttribute('aria-expanded', 'false');
    lastFocused?.focus?.({ preventScroll: true });
  };

  canvas.addEventListener('click', event => {
    if (character.hitTest(event.clientX, event.clientY)) openChat();
  });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openChat(); }
  });
  close?.addEventListener('click', closeChat);
  speech?.addEventListener('click', openChat);
  speech?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openChat(); }
  });
  document.querySelector('#mascot-replay')?.addEventListener('click', () => {
    if (stage.classList.contains('chat-open')) closeChat();
    character.replay();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && stage.classList.contains('chat-open')) closeChat();
  });

  const answerFor = rawQuestion => {
    const question = rawQuestion.trim().toLowerCase();
    if (/안녕|반가|hello|hi/.test(question)) {
      return { text: '안녕. 이 페이지에서 송형록의 프로젝트, CTF, 버그바운티 기록을 안내하고 있어. 아래 주제 중 하나를 물어봐.' };
    }
    if (/소개|누구|송형록|어떤 사람|who/.test(question)) {
      return {
        text: '송형록은 웹과 시스템 보안을 공부하고 있어. 직접 만든 보안 도구, CTF 참가 기록, 오픈소스에서 찾은 취약점을 이 페이지에 정리해 두었어.',
        links: [{ label: '프로필 보기', href: '#profile' }]
      };
    }
    if (/프로젝트|만든|개발|malware|악성|ids/.test(question)) {
      return {
        text: '프로젝트는 두 개를 기록해 두었어. PE 정적 분석 결과를 로컬 LLM이 설명하는 악성코드 분석 도구와, 웹 요청에서 SQL Injection·XSS·Path Traversal 흔적을 찾는 WEB mini-IDS야.',
        links: [
          { label: '악성코드 분석 기록', href: 'project-ai-malware-detector.html' },
          { label: 'WEB mini-IDS 기록', href: 'project-web-mini-ids.html' }
        ]
      };
    }
    if (/ctf|대회|순위|수상/.test(question)) {
      return {
        text: 'ATHENA CTF 2026에서 전체 4위를 기록했고, boroCTF·Grey Cat CTF·WaRP vs s0sCoD3 CTF 같은 대회 기록도 남겨 두었어.',
        links: [{ label: 'CTF 기록 보기', href: '#ctf' }]
      };
    }
    if (/web3|디파이|defi|tari|ootle|유동성|lp 토큰/.test(question)) {
      return {
        text: 'Web3 보안 기록에는 Tari Ootle의 공개 유동성 풀 문제를 따로 정리해 뒀어. LP 토큰 발행 권한 때문에 준비금 없이 만든 토큰을 환급할 수 있었고, CVE는 발급 중이야.',
        links: [{ label: 'Web3 · Tari 기록', href: 'bounty-tari-liquidity-pool.html' }]
      };
    }
    if (/버그|바운티|취약점|cve|hortus|sqli|csrf|envd|toctou|레이스|oro|checkout|체크아웃/.test(question)) {
      return {
        text: '버그바운티 기록에는 OroCommerce의 체크아웃 권한 문제, envd의 경로 이탈·TOCTOU, HortusFox의 SQL Injection과 CSRF가 있어. OroCommerce 건은 이메일로 제보했고 공개 어드바이저리와 CVE는 없어. 나머지 세 건은 CVE 발급 중이고, Tari Ootle은 Web3 보안 기록으로 분리했어.',
        links: [
          { label: 'OroCommerce 기록', href: 'bounty-orocommerce-checkout.html' },
          { label: 'envd 기록', href: 'bounty-envd-requirements.html' },
          { label: 'SQL Injection 기록', href: 'bounty-hortusfox-sqli.html' },
          { label: 'CSRF 기록', href: 'bounty-hortusfox-csrf.html' },
          { label: 'Web3 · Tari 기록', href: 'bounty-tari-liquidity-pool.html' }
        ]
      };
    }
    if (/기술|스택|언어|python|도구/.test(question)) {
      return { text: '주로 Python, FastAPI, PySide6, Linux와 웹·시스템 분석 도구를 사용해. 프로젝트에서는 PE 정적 분석, 규칙 기반 탐지, 로컬 Ollama 연동을 다뤘어.' };
    }
    if (/자격|교육|훈련|training|credential/.test(question)) {
      return {
        text: '정보기기운용기능사, 컴퓨터활용능력 2급, ITQ OA Master 기록과 현대오토에버 화이트해커 양성교육·서울여대 AI·정보보호영재교육원 전문 R&E 참여 기록이 있어.',
        links: [{ label: '교육·자격 기록 보기', href: '#record' }]
      };
    }
    if (/연락|메일|email|contact|깃허브|github/.test(question)) {
      return {
        text: '연락은 songhr498@gmail.com으로 받을 수 있어. GitHub와 Dreamhack 프로필은 페이지 아래 연락처 영역에 연결해 두었어.',
        links: [{ label: '연락처 보기', href: '#contact' }]
      };
    }
    return { text: '이 소개 챗봇은 페이지에 정리된 내용만 답해. “소개”, “프로젝트”, “CTF”, “버그바운티”, “기술”, “자격”, “연락처” 중 하나를 물어봐.' };
  };

  const appendMessage = (text, type, links = []) => {
    const message = document.createElement('div');
    message.className = `chat-message ${type}`;
    message.textContent = text;
    links.forEach(link => {
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.textContent = `${link.label} ↗`;
      message.appendChild(anchor);
    });
    log.appendChild(message);
    log.scrollTop = log.scrollHeight;
    return message;
  };

  const ask = question => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || pendingAnswer) return;
    pendingAnswer = true;
    log.setAttribute('aria-busy', 'true');
    appendMessage(cleanQuestion, 'user');
    input.value = '';
    character.listen();
    const typing = appendMessage('•••', 'bot typing');
    window.setTimeout(() => {
      typing.remove();
      const answer = answerFor(cleanQuestion);
      appendMessage(answer.text, 'bot', answer.links || []);
      log.setAttribute('aria-busy', 'false');
      character.answer(Math.min(6.5, Math.max(3.2, answer.text.length * .045)));
      pendingAnswer = false;
    }, 600);
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    ask(input.value);
  });
  document.querySelectorAll('[data-chat-question]').forEach(button => {
    button.addEventListener('click', () => {
      openChat();
      ask(button.dataset.chatQuestion || '');
    });
  });

  import('./mascot-scene.js').then(({ createKnightGuide }) => {
    character = createKnightGuide(stage, canvas);
    character.setOpen(stage.classList.contains('chat-open'));
  }).catch(error => {
    console.warn('3D 캐릭터를 불러오지 못했습니다. 대화 기능은 계속 사용할 수 있습니다.', error);
  });
})();
