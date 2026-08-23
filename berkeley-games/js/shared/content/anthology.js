// Anthology shell content (Front Matter Revision §1-§5, §7, §14, §16).

export const ANTHOLOGY = {
  title: 'ELECTIONS HAVE CONSEQUENCES',
  edition: 'Berkeley Edition',
  action: 'CHOOSE A GAME'
};

/**
 * Game cards: title, hook, short description, status. Deliberately no
 * punchlines here (§4) — the titles set the tone and the game delivers it.
 */
export const EPISODES = [
  {
    id: 'budget-quest',
    title: 'BUDGET QUEST',
    hook: 'If you’re wondering who the ATM is, you’re the ATM.',
    description: 'Balance Berkeley’s budget. Try not to wreck Berkeley doing it.',
    status: 'playable'
  },
  {
    id: 'how-berkeley',
    title: 'HOW BERKELEY CAN YOU BE?',
    hook: 'A Special Meeting. Public comment. Political pressure.',
    description: 'See how long you can keep everyone happy.',
    status: 'playable'
  },
  {
    id: 'hopkins',
    title: 'THE HOPKINS OF TOMORROW',
    hook: 'Cross the street. Answer an emergency call. Take out the trash.',
    description: 'One council decision, three ways to live with it.',
    status: 'playable'
  },
  {
    id: 'sacramento',
    title: 'GET TO SACRAMENTO OR DIE TRYIN’',
    hook: 'Keep enough people happy enough for long enough.',
    description: 'A campaign calendar, several constituencies, and two buttons.',
    status: 'playable'
  }
];

// Local-only completion markers (§20). Never an account, never a backend.
export const COMPLETION_KEY = 'ehc.completed';
