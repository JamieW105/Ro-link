import PostEditor from '../PostEditor';

export default function NewPostPage() {
    return (
        <PostEditor
            submitUrl="/api/management/posts"
            submitMethod="POST"
            heading="Create Update Post"
            subheading="Write a release note with structured feature sections and optional smaller follow-up notes."
            submitLabel="Publish Post"
        />
    );
}
