import React, { createContext, useContext, useMemo, useReducer } from 'react';
import {
  NOW,
  Occurrence,
  Payment,
  Registration,
  baseBooked,
  creditDeadline,
  groupById,
  initialPayments,
  initialRegistrations,
  preFilled,
} from './data';

export type BookingSource = 'tillgodo' | 'klippkort' | 'drop-in';

/** Informationssida som en notis kan leda till, för sådant som inte har en egen plats i appen. */
export interface InfoPage {
  heading: string;
  text: string;
  link?: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  at: Date;
  page?: InfoPage;
}

export interface MySignup {
  perWeek: 1 | 2 | 3;
  choices: string[][];
  friend: string;
  installments: boolean;
  at: Date;
}

interface State {
  cancelled: Record<string, 'tillgodo' | 'sent'>;
  extra: Record<string, BookingSource>;
  waitlist: string[];
  attending: Record<string, boolean>;
  punchLeft: number;
  inbox: Notice[];
  banner: Notice | null;
  toast: { title: string; body: string } | null;
  openNotice: string | null;
  registrations: Registration[];
  payments: Payment[];
  mySignup: MySignup | null;
}

type Action =
  | { type: 'cancel'; occ: Occurrence }
  | { type: 'undoCancel'; occ: Occurrence }
  | { type: 'book'; occ: Occurrence; source: BookingSource }
  | { type: 'unbook'; occ: Occurrence }
  | { type: 'joinWaitlist'; occ: Occurrence }
  | { type: 'leaveWaitlist'; occ: Occurrence }
  | { type: 'attend'; occ: Occurrence }
  | { type: 'push'; title: string; body: string; page?: InfoPage }
  | { type: 'openNotice'; id: string }
  | { type: 'closeNotice' }
  | { type: 'dismissBanner' }
  | { type: 'toast'; title: string; body: string }
  | { type: 'dismissToast' }
  | { type: 'signup'; signup: MySignup }
  | { type: 'confirmRegistrations'; decisions: Record<string, 'bekräftad' | 'väntelista'> }
  | { type: 'togglePaid'; id: string };

let seq = 0;
const notice = (title: string, body: string, page?: InfoPage): Notice => ({ id: `n${++seq}`, title, body, at: new Date(), page });

const initial: State = {
  cancelled: {},
  extra: {},
  waitlist: [],
  attending: {},
  punchLeft: 7,
  inbox: [
    {
      id: 'n-advent',
      title: 'AdventsFYS & AdventsMYS sön 29/11',
      body: 'Vår årliga tradition är tillbaka. Tryck för att läsa mer och anmäla dig.',
      at: new Date(2026, 9, 17, 14, 0),
      page: {
        heading: 'AdventsFYS & AdventsMYS',
        text:
          'Söndag 29/11 kl 16.00 till cirka 17.30.\n\nVi startar med ett gott pass i Ladan. Efter passet bjuds det på fika och mysigt häng inne i gymmet.\n\nI priset på 280 kr ingår träningspass, årets tröja och fika. Tröjan finns i storlek S till XXL och provexemplar finns i väntrummet. Skriv din storlek på listan senast fredag 6/11.\n\nTagga gärna någon du vill ska komma också!',
      },
    },
    {
      id: 'n-welcome',
      title: 'Välkommen till CT-omgång v 45–51!',
      body: 'Ditt ordinarie pass är tisdagar 18.45 i Gymmet. Lämna återbud senast dagen innan så får du passet tillgodo.',
      at: new Date(2026, 10, 1, 9, 0),
    },
  ],
  banner: null,
  toast: null,
  openNotice: null,
  registrations: initialRegistrations,
  payments: initialPayments,
  mySignup: null,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'cancel': {
      const kind = NOW < creditDeadline(a.occ) ? 'tillgodo' : 'sent';
      const { [a.occ.id]: _, ...attending } = s.attending;
      return { ...s, cancelled: { ...s.cancelled, [a.occ.id]: kind }, attending };
    }
    case 'undoCancel': {
      const { [a.occ.id]: _, ...cancelled } = s.cancelled;
      return { ...s, cancelled };
    }
    case 'book': {
      const punchLeft = a.source === 'klippkort' ? s.punchLeft - 1 : s.punchLeft;
      return {
        ...s,
        punchLeft,
        extra: { ...s.extra, [a.occ.id]: a.source },
        waitlist: s.waitlist.filter((w) => w !== a.occ.id),
      };
    }
    case 'unbook': {
      const source = s.extra[a.occ.id];
      const { [a.occ.id]: _, ...extra } = s.extra;
      return { ...s, extra, punchLeft: source === 'klippkort' ? s.punchLeft + 1 : s.punchLeft };
    }
    case 'joinWaitlist':
      return { ...s, waitlist: [...s.waitlist, a.occ.id] };
    case 'leaveWaitlist':
      return { ...s, waitlist: s.waitlist.filter((w) => w !== a.occ.id) };
    case 'attend':
      return { ...s, attending: { ...s.attending, [a.occ.id]: true } };
    case 'push': {
      const n = notice(a.title, a.body, a.page);
      return { ...s, inbox: [n, ...s.inbox], banner: n, toast: { title: 'Notisen är skickad', body: a.title } };
    }
    case 'openNotice':
      return { ...s, openNotice: a.id, banner: null };
    case 'closeNotice':
      return { ...s, openNotice: null };
    case 'dismissBanner':
      return { ...s, banner: null };
    case 'toast':
      return { ...s, toast: { title: a.title, body: a.body } };
    case 'dismissToast':
      return { ...s, toast: null };
    case 'signup': {
      const n = notice(
        'Anmälan mottagen',
        'Din anmälan till CT-omgång v 2–8 2027 är registrerad. Du får en notis när Emma bekräftat din plats.',
      );
      return { ...s, mySignup: a.signup, inbox: [n, ...s.inbox], banner: n };
    }
    case 'confirmRegistrations': {
      const registrations = s.registrations.map((r) =>
        a.decisions[r.id] ? { ...r, status: a.decisions[r.id] } : r,
      );
      const n = notice(
        'Din plats är bekräftad',
        'Välkommen till CT-omgång v 2–8 2027. Betala senast 22/12 – tryck här för att Swisha.',
      );
      return { ...s, registrations, inbox: [n, ...s.inbox], banner: n };
    }
    case 'togglePaid':
      return { ...s, payments: s.payments.map((p) => (p.id === a.id ? { ...p, paid: !p.paid } : p)) };
  }
}

interface Ctx extends State {
  dispatch: React.Dispatch<Action>;
  credits: number;
  bookedCount: (o: Occurrence) => number;
  capacity: (o: Occurrence) => number;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo<Ctx>(() => {
    const earned = Object.values(state.cancelled).filter((c) => c === 'tillgodo').length;
    const used = Object.values(state.extra).filter((e) => e === 'tillgodo').length;
    return {
      ...state,
      dispatch,
      credits: earned - used,
      capacity: (o) => groupById(o.groupId).capacity,
      bookedCount: (o) => {
        let n = baseBooked(o);
        if (state.cancelled[o.id]) n -= 1;
        if (state.extra[o.id]) n += 1;
        return n;
      },
    };
  }, [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore utanför StoreProvider');
  return ctx;
}

export { preFilled };
