import Ziele from "../../(app)/ziele/page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function DemoZiele(props) {
  return <Ziele {...props} demo />;
}
