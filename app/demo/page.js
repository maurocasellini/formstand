import Heute from "../(app)/heute/page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function DemoHeute(props) {
  return <Heute {...props} demo />;
}
