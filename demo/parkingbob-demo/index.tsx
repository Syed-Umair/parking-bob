import {
  Bar,
  Button,
  Check,
  Collapse,
  Field,
  Stage,
  Stream,
  Text,
  Window,
  type Act,
} from "./kit";
import "./demo.css";

// parkingBob faux product demo — dark theme, slate/navy + electric-blue.
//
// Five beats:
//   1. User types "find car parking in Koramangala under ₹50"
//   2. parkingBob is thinking… (animated dots)
//   3. AI reply streams in
//   4. Two spot cards slide in below the reply
//   5. User clicks "Book" on the first card → modal opens (booking state)
//
// Based on ai-cards gold example. Plays once; poster is the payoff (booked state).

const Q = "find car parking in Koramangala under ₹50";
const REPLY =
  "Found 3 spots in Koramangala. Cheapest: Shaded Driveway near Forum Mall at ₹50/hr (CCTV, Covered). Two more available below.";
const REPLY_WORDS = REPLY.split(" ").length;

const SPOTS = [
  {
    title: "Shaded Driveway near Forum Mall",
    area: "Koramangala",
    rate: 50,
    amenities: "CCTV · Covered",
    host: "Priya S.",
    hours: "8am–10pm",
  },
  {
    title: "Open Parking, 5th Block",
    area: "Koramangala",
    rate: 60,
    amenities: "24/7 · Gated",
    host: "Rahul M.",
    hours: "6am–11pm",
  },
];

type S = {
  draft: string;
  sent: boolean;
  phase: "idle" | "thinking" | "answer";
  words: number;
  cards: boolean;
  pick: number | null;
  book: "idle" | "busy" | "done";
};

const initial: S = {
  draft: "",
  sent: false,
  phase: "idle",
  words: 0,
  cards: false,
  pick: null,
  book: "idle",
};

const poster: S = {
  draft: "",
  sent: true,
  phase: "answer",
  words: REPLY_WORDS,
  cards: true,
  pick: 0,
  book: "done",
};

async function script(a: Act<S>) {
  await a.wait(600);
  a.mark("type");
  await a.type("draft", Q, { interval: 36 });
  await a.wait(350);
  a.mark("send");
  a.put({ sent: true, draft: "" });
  await a.wait(400);
  a.put({ phase: "thinking" });
  await a.wait(1200);
  a.mark("stream");
  a.put({ phase: "answer" });
  for (let i = 1; i <= REPLY_WORDS; i++) {
    a.put({ words: i });
    await a.wait(38);
  }
  await a.wait(300);
  a.mark("cards");
  a.put({ cards: true });
  await a.wait(1100);
  a.mark("pick");
  await a.click({ at: "spot-0", x: 0.5, y: 0.5 });
  a.put({ pick: 0 });
  await a.wait(600);
  a.mark("book");
  await a.click({ at: "book-0", x: 0.75, y: 0.5 });
  a.put({ book: "busy" });
  await a.wait(1300);
  a.mark("done");
  a.put({ book: "done" });
  await a.move({ wide: { x: 580, y: 460 }, compact: { x: 320, y: 540 } });
  await a.wait(2800);
}

export default function ParkingBobDemo() {
  return (
    <Stage
      width={640}
      height={500}
      compact={{ below: 600, width: 358, height: 580 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      theme="dark"
      className="pb"
    >
      {(s) => (
        <Window title="parkingBob" className="pb-win">
          <div className="pb-body">
            <div className="pb-thread">
              {/* Earlier placeholder turns — eye lands on the live exchange */}
              <div className="pb-past">
                <Bar w={160} h={28} r={14} tone={1} className="pb-past-q" />
                <Bar w="72%" h={7} r={3} tone={2} />
                <Bar w="50%" h={7} r={3} tone={2} />
              </div>

              {/* User message */}
              <Collapse open={s.sent} reveal="drop" from="below">
                <div className="pb-q">
                  <Text>{Q}</Text>
                </div>
              </Collapse>

              {/* Thinking state */}
              <Collapse open={s.phase === "thinking"}>
                <div className="pb-thinking">
                  <span className="pb-dot" />
                  <span className="pb-dot" />
                  <span className="pb-dot" />
                </div>
              </Collapse>

              {/* AI reply + spot cards */}
              <Collapse open={s.phase === "answer"}>
                <div className="pb-a" data-on>
                  <Stream
                    className="pb-stream"
                    text={REPLY}
                    count={s.words}
                  />

                  {/* Spot cards slide in after reply streams */}
                  <Collapse open={s.cards} reveal="drop">
                    <div className="pb-spots">
                      {SPOTS.map((spot, i) => (
                        <div
                          key={i}
                          className="pb-spot"
                          data-target={`spot-${i}`}
                          data-cursor="pointer"
                          data-on={s.pick === i || undefined}
                          data-booked={
                            (s.book === "done" && s.pick === i) || undefined
                          }
                        >
                          <div className="pb-spot__info">
                            <span className="pb-spot__title">{spot.title}</span>
                            <span className="pb-spot__meta">
                              {spot.area} · {spot.hours} · {spot.host}
                            </span>
                            <span className="pb-spot__tags">
                              {spot.amenities}
                            </span>
                          </div>
                          <div className="pb-spot__right">
                            <span className="pb-spot__rate">
                              ₹{spot.rate}
                              <span className="pb-spot__unit">/hr</span>
                            </span>
                            <span
                              className="pb-book-btn"
                              data-target={`book-${i}`}
                              data-cursor="pointer"
                              data-ready={s.pick === i || undefined}
                              data-done={
                                (s.book === "done" && s.pick === i) || undefined
                              }
                            >
                              <span
                                className="pb-layer"
                                data-on={s.pick !== i || undefined}
                              >
                                Book
                              </span>
                              <span
                                className="pb-layer"
                                data-on={
                                  (s.pick === i && s.book === "idle") ||
                                  undefined
                                }
                              >
                                Book
                              </span>
                              <span
                                className="pb-layer"
                                data-on={
                                  (s.pick === i && s.book === "busy") ||
                                  undefined
                                }
                              >
                                <Check on={false} pending size={14} />
                              </span>
                              <span
                                className="pb-layer"
                                data-on={
                                  (s.pick === i && s.book === "done") ||
                                  undefined
                                }
                              >
                                <Check on={true} size={14} />
                                Booked
                              </span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Collapse>
                </div>
              </Collapse>
            </div>

            <Field
              className="pb-composer"
              value={s.draft}
              placeholder="Ask parkingBob…"
              focused={!s.sent}
            />
          </div>
        </Window>
      )}
    </Stage>
  );
}
