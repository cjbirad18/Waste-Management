import { notFound } from "next/navigation";

async function fetchUser(id: string) {
  const response = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
  if (!response.ok) {
    return null;
  }
  const user = await response.json();
  return user;
}

export default async function UsersPage({
  params,
}: {
  params: { userId: string };
}) {
  const { userId } = params;
  const user = await fetchUser(userId);

  if (!user) {
    notFound();
  }

  return (
    <main>
      <h1>{user.name}</h1>
      <p>
        <strong>Email:</strong> {user.email} <br />
        <strong>Phone:</strong> {user.phone} <br />
        <strong>Website:</strong> {user.website} <br />
      </p>
    </main>
  );
}
