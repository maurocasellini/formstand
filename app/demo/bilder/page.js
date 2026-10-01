import Bilder from "../../(app)/bilder/page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function DemoBilder(props) {
  return <Bilder {...props} demo />;
}
