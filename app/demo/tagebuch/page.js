import Tagebuch from "../../(app)/tagebuch/page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function DemoTagebuch(props) {
  return <Tagebuch {...props} demo />;
}
