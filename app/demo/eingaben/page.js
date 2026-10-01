import Eingaben from "../../(app)/eingaben/page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function DemoEingaben(props) {
  return <Eingaben {...props} demo />;
}
