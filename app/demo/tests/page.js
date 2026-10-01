import Tests from "../../(app)/tests/page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function DemoTests(props) {
  return <Tests {...props} demo />;
}
