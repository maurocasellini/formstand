import Entwicklung from "../../(app)/entwicklung/page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function DemoEntwicklung(props) {
  return <Entwicklung {...props} demo />;
}
